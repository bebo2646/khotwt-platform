<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class WordImportService
{
    /**
     * Parse a .docx file and extract questions, choices, answers, scores, and embedded images.
     *
     * @param UploadedFile $file
     * @return array
     * @throws \Exception
     */
    public function import(UploadedFile $file, ?int $teacherId = null): array
    {
        $extension = strtolower($file->getClientOriginalExtension());
        if ($extension === 'doc') {
            throw new \Exception('يرجى حفظ الملف بصيغة Word الحديثة (.docx) وإعادة المحاولة. ملفات .doc القديمة غير مدعومة.');
        }

        if ($extension !== 'docx') {
            throw new \Exception('الملف المحدد ليس ملف وورد بصيغة .docx.');
        }

        if (!class_exists('ZipArchive')) {
            throw new \Exception('امتداد معالجة ملفات الوورد (PHP ZipArchive) غير متوفر على الخادم. يرجى التأكد من تفعيل مكتبة zip في إعدادات PHP.');
        }

        $zip = new \ZipArchive;
        $openResult = $zip->open($file->getRealPath());
        if ($openResult !== true) {
            throw new \Exception('تعذر فتح ملف Word. يرجى التأكد من سلامة الملف وإعادة المحاولة.');
        }

        try {
            // 1. Extract embedded images and build rId -> public_url map
            $rIdToUrl = $this->extractImages($zip, $teacherId);

            // 2. Read word/document.xml
            $docIndex = $zip->locateName('word/document.xml', \ZipArchive::FL_NOCASE);
            if ($docIndex === false) {
                throw new \Exception('الملف لا يحتوي على محتوى Word صالح (word/document.xml مفقود).');
            }
            $docXml = $zip->getFromIndex($docIndex);
            if ($docXml === false) {
                throw new \Exception('تعذر قراءة محتوى المستند من ملف Word.');
            }

            // 3. Parse paragraphs and tables preserving sequence
            $blocks = $this->parseXmlBlocks($docXml, $rIdToUrl);

            // 4. Extract questions from structured blocks
            $questions = $this->extractQuestionsFromBlocks($blocks);

            if (empty($questions)) {
                // Fallback attempt: plain text parsing
                $questions = $this->fallbackParseText($blocks);
            }

            return $questions;
        } finally {
            $zip->close();
        }
    }

    /**
     * Extract media images from docx and map rId to public URL.
     */
    protected function extractImages(\ZipArchive $zip, ?int $teacherId = null): array
    {
        $rIdToUrl = [];
        $relsIndex = $zip->locateName('word/_rels/document.xml.rels', \ZipArchive::FL_NOCASE);
        if ($relsIndex === false) {
            return $rIdToUrl;
        }
        $relsXml = $zip->getFromIndex($relsIndex);
        if (!$relsXml) {
            return $rIdToUrl;
        }

        $relsDoc = new \DOMDocument();
        libxml_use_internal_errors(true);
        if (!$relsDoc->loadXML($relsXml)) {
            libxml_clear_errors();
            return $rIdToUrl;
        }
        libxml_clear_errors();

        $folder = $teacherId ? "exams/teacher_{$teacherId}" : 'exams';

        $relationships = $relsDoc->getElementsByTagName('Relationship');
        foreach ($relationships as $rel) {
            $type = $rel->getAttribute('Type');
            $id = $rel->getAttribute('Id');
            $target = $rel->getAttribute('Target');

            if (str_contains($type, 'image') && $id && $target) {
                // Target is relative to word/ (e.g., media/image1.png)
                $zipPath = 'word/' . ltrim($target, '/');
                $imageBytes = $zip->getFromName($zipPath);

                if ($imageBytes !== false) {
                    $ext = pathinfo($target, PATHINFO_EXTENSION) ?: 'png';
                    if (!in_array(strtolower($ext), ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'])) {
                        $ext = 'png';
                    }

                    $filename = 'exam_import_' . Str::random(20) . '.' . strtolower($ext);
                    $storagePath = $folder . '/' . $filename;

                    Storage::disk('public')->put($storagePath, $imageBytes);

                    $url = asset('storage/' . $storagePath);
                    $url = str_replace('http://', 'https://', $url);
                    $rIdToUrl[$id] = $url;
                }
            }
        }

        return $rIdToUrl;
    }

    /**
     * Parse document.xml into sequential blocks with text and images.
     */
    protected function parseXmlBlocks(string $xml, array $rIdToUrl): array
    {
        $blocks = [];

        $dom = new \DOMDocument();
        libxml_use_internal_errors(true);
        if (!$dom->loadXML($xml)) {
            libxml_clear_errors();
            return $blocks;
        }
        libxml_clear_errors();

        // Get all paragraph nodes
        $pNodes = $dom->getElementsByTagName('p');
        if ($pNodes->length === 0) {
            $pNodes = $dom->getElementsByTagNameNS('*', 'p');
        }

        foreach ($pNodes as $pNode) {
            $images = [];

            // Find drawing images (a:blip)
            $blipNodes = $pNode->getElementsByTagName('blip');
            if ($blipNodes->length === 0) {
                $blipNodes = $pNode->getElementsByTagNameNS('*', 'blip');
            }
            foreach ($blipNodes as $blip) {
                foreach ($blip->attributes as $attr) {
                    $val = $attr->nodeValue;
                    if (isset($rIdToUrl[$val])) {
                        $images[] = $rIdToUrl[$val];
                    }
                }
            }

            // Find legacy v:imagedata
            $vImgNodes = $pNode->getElementsByTagName('imagedata');
            if ($vImgNodes->length === 0) {
                $vImgNodes = $pNode->getElementsByTagNameNS('*', 'imagedata');
            }
            foreach ($vImgNodes as $vImg) {
                foreach ($vImg->attributes as $attr) {
                    $val = $attr->nodeValue;
                    if (isset($rIdToUrl[$val])) {
                        $images[] = $rIdToUrl[$val];
                    }
                }
            }

            // Extract text from <w:t> elements
            $tNodes = $pNode->getElementsByTagName('t');
            if ($tNodes->length === 0) {
                $tNodes = $pNode->getElementsByTagNameNS('*', 't');
            }
            $textParts = [];
            foreach ($tNodes as $t) {
                $textParts[] = $t->nodeValue;
            }

            $text = implode('', $textParts);
            $text = trim(preg_replace('/\s+/u', ' ', $text));

            if ($text !== '' || !empty($images)) {
                $blocks[] = [
                    'text' => $text,
                    'images' => $images,
                ];
            }
        }

        return $blocks;
    }

    /**
     * Extract questions from blocks.
     */
    protected function extractQuestionsFromBlocks(array $blocks): array
    {
        $rawQuestions = [];
        $currentQ = null;

        foreach ($blocks as $block) {
            $line = $block['text'];
            $images = $block['images'];

            // Check if this block is a new question header
            $isNewQ = false;
            $extractedQText = '';
            $qScore = 1;

            if ($line !== '' && $this->isQuestionHeader($line, $extractedQText, $qScore)) {
                $isNewQ = true;
            }

            if ($isNewQ) {
                if ($currentQ !== null) {
                    $rawQuestions[] = $currentQ;
                }
                $currentQ = [
                    'text' => $extractedQText !== '' ? $extractedQText : $line,
                    'image_url' => !empty($images) ? $images[0] : null,
                    'score' => $qScore,
                    'raw_lines' => [],
                ];
                // If there are more images in the header, or extra text
                continue;
            }

            if ($currentQ !== null) {
                $currentQ['raw_lines'][] = [
                    'text' => $line,
                    'images' => $images,
                ];
            } else {
                // Might be question 1 without an explicit prefix
                if ($line !== '' || !empty($images)) {
                    $currentQ = [
                        'text' => $line,
                        'image_url' => !empty($images) ? $images[0] : null,
                        'score' => 1,
                        'raw_lines' => [],
                    ];
                }
            }
        }

        if ($currentQ !== null) {
            $rawQuestions[] = $currentQ;
        }

        // Process each raw question to extract choices and correct answer
        $finalQuestions = [];
        foreach ($rawQuestions as $raw) {
            $parsed = $this->finalizeQuestion($raw);
            if ($parsed !== null) {
                $finalQuestions[] = $parsed;
            }
        }

        return $finalQuestions;
    }

    /**
     * Check if a line is a question header.
     */
    protected function isQuestionHeader(string $line, string &$extractedText, int &$score): bool
    {
        // Check for score indicator: e.g. [2 درجات] or (درجتان) or (Score: 5)
        if (preg_match('/[\(\[]\s*(\d+)\s*(?:درجة|درجات|درجتان|علامات|علامة|marks?|points?|pts?)\s*[\)\]]/ui', $line, $scoreMatch)) {
            $score = (int)$scoreMatch[1];
            $line = trim(preg_replace('/[\(\[]\s*\d+\s*(?:درجة|درجات|درجتان|علامات|علامة|marks?|points?|pts?)\s*[\)\]]/ui', '', $line));
        }

        // 1. س1: or س 1: or س(1) or س-1
        if (preg_match('/^(?:س|السؤال)\s*(?:\(?\d+\)?|[أ-ي]+)[\s\)\-\.：:]+(.*)$/ui', $line, $matches)) {
            $extractedText = trim($matches[1]);
            return true;
        }

        // 2. Q1: or Question 1: or Q.1
        if (preg_match('/^(?:Q|Question)\.?\s*(?:\(?\d+\)?)[\s\)\-\.：:]+(.*)$/ui', $line, $matches)) {
            $extractedText = trim($matches[1]);
            return true;
        }

        // 3. Numbered: 1. or 1- or 1) or (1)
        if (preg_match('/^(?:\(?\s*\d+\s*[\.\-\)]|\(\s*\d+\s*\))\s*(.+)$/u', $line, $matches)) {
            $extractedText = trim($matches[1]);
            return true;
        }

        return false;
    }

    /**
     * Finalize question: parse options, correct answer, type, and link images.
     */
    protected function finalizeQuestion(array $raw): ?array
    {
        $questionText = trim($raw['text']);
        $questionImage = $raw['image_url'];
        $score = $raw['score'] ?? 1;

        $options = [];
        $correctAnswer = '';
        $pendingOptionImage = null;

        // Process raw lines
        foreach ($raw['raw_lines'] as $lineItem) {
            $text = trim($lineItem['text']);
            $images = $lineItem['images'];

            // Check if this line is an answer indicator
            if (preg_match('/^(?:الإجابة\s*الصحيحة|الاجابة\s*الصحيحة|الإجابة|الاجابة|الحل|الجواب|مفتاح\s*الحل|Correct\s*Answer|Answer|Ans)[\s:：\-]+(.*)$/ui', $text, $ansMatch)) {
                $rawAns = trim($ansMatch[1]);
                $correctAnswer = $rawAns;
                continue;
            }

            // Check if this line has multiple inline choices: e.g. أ) ... ب) ... ج) ... د) ...
            $splitChoices = $this->splitInlineChoices($text);
            if (!empty($splitChoices)) {
                foreach ($splitChoices as $sc) {
                    $options[] = [
                        'letter' => $sc['letter'],
                        'text' => $sc['text'],
                        'image_url' => !empty($images) ? array_shift($images) : null,
                    ];
                }
                continue;
            }

            // Check if line is a single choice: e.g. أ) خيار
            $singleChoice = $this->parseChoiceLine($text);
            if ($singleChoice !== null) {
                $choiceImg = !empty($images) ? $images[0] : null;
                $options[] = [
                    'letter' => $singleChoice['letter'],
                    'text' => $singleChoice['text'],
                    'image_url' => $choiceImg,
                ];
                continue;
            }

            // If line is not a choice, it could be additional question text or question image
            if (empty($options)) {
                if ($text !== '') {
                    $questionText .= ($questionText !== '' ? ' ' : '') . $text;
                }
                if ($questionImage === null && !empty($images)) {
                    $questionImage = $images[0];
                }
            } else {
                // If options already started, an image here might belong to the last option
                if (!empty($images) && count($options) > 0) {
                    $lastIdx = count($options) - 1;
                    if (empty($options[$lastIdx]['image_url'])) {
                        $options[$lastIdx]['image_url'] = $images[0];
                    }
                }
            }
        }

        // Determine question type
        $type = 'essay';
        $formattedOptions = null;

        if (count($options) >= 2) {
            $isTrueFalse = count($options) === 2 && (
                in_array($options[0]['text'], ['صح', 'خطأ', 'صواب']) ||
                in_array($options[1]['text'], ['صح', 'خطأ', 'صواب']) ||
                in_array(strtolower($options[0]['text']), ['true', 'false'])
            );

            if ($isTrueFalse) {
                $type = 'true_false';
                $formattedOptions = ['صح', 'خطأ'];
                if ($correctAnswer === 'صواب' || strtolower($correctAnswer) === 'true') {
                    $correctAnswer = 'صح';
                } elseif (strtolower($correctAnswer) === 'false') {
                    $correctAnswer = 'خطأ';
                }
            } else {
                $type = 'mcq';
                // Build options list
                $formattedOptions = [];
                $letterToOpt = [];

                foreach ($options as $idx => $opt) {
                    $optData = [
                        'text' => $opt['text'] ?? '',
                        'image_url' => $opt['image_url'] ?? null,
                    ];
                    $formattedOptions[] = $optData;
                    if (!empty($opt['letter'])) {
                        $letterToOpt[mb_strtolower($opt['letter'])] = $optData;
                    }
                    $letterToOpt[(string)($idx + 1)] = $optData;
                }

                // If correct answer is a letter or number, resolve to option text or image
                $normCorrect = mb_strtolower(trim($correctAnswer));
                if (isset($letterToOpt[$normCorrect])) {
                    $matched = $letterToOpt[$normCorrect];
                    $correctAnswer = !empty($matched['text']) ? $matched['text'] : ($matched['image_url'] ?? '');
                }
            }
        } elseif (preg_match('/\(?\s*(?:صح\s*أم\s*خطأ|صح\s*\/\s*خطأ|صواب\s*أم\s*خطأ)\s*\)?/ui', $questionText)) {
            $type = 'true_false';
            $formattedOptions = ['صح', 'خطأ'];
            if ($correctAnswer === 'صواب' || strtolower($correctAnswer) === 'true') {
                $correctAnswer = 'صح';
            } elseif (strtolower($correctAnswer) === 'false') {
                $correctAnswer = 'خطأ';
            }
        }

        if ($questionText === '' && $questionImage === null) {
            return null;
        }

        return [
            'text' => $questionText,
            'image_url' => $questionImage,
            'type' => $type,
            'options' => $formattedOptions,
            'correct_answer' => $correctAnswer,
            'score' => $score > 0 ? $score : 1,
        ];
    }

    /**
     * Parse a single choice line.
     */
    protected function parseChoiceLine(string $text): ?array
    {
        // 1. Arabic: أ) or أ. or (أ) or [أ]
        if (preg_match('/^(?:[\(\[]?([أ-ي])[\)\]\.\-\:：\x{FF09}\x{FF0E}]|\(([أ-ي])\))\s*(.*)$/ui', $text, $matches)) {
            $letter = !empty($matches[1]) ? $matches[1] : $matches[2];
            return ['letter' => $letter, 'text' => trim($matches[3])];
        }

        // 2. English: A) or A. or (A) or [A]
        if (preg_match('/^(?:[\(\[]?([A-Za-z])[\)\]\.\-\:：\x{FF09}\x{FF0E}]|\(([A-Za-z])\))\s*(.*)$/u', $text, $matches)) {
            $letter = !empty($matches[1]) ? $matches[1] : $matches[2];
            return ['letter' => strtoupper($letter), 'text' => trim($matches[3])];
        }

        // 3. Numbered choices: (1) or 1)
        if (preg_match('/^\(([1-4])\)\s*(.*)$/u', $text, $matches)) {
            return ['letter' => $matches[1], 'text' => trim($matches[2])];
        }

        return null;
    }

    /**
     * Split inline choices if multiple options are on the same line.
     */
    protected function splitInlineChoices(string $text): array
    {
        $pattern = '/(?:^|\s+)(?:[\(\[]?([أ-دA-Da-d])[\)\]\.\-\:：\x{FF09}\x{FF0E}]|\(([أ-دA-Da-d])\))\s*/u';
        if (preg_match_all($pattern, $text, $matches, PREG_OFFSET_CAPTURE)) {
            if (count($matches[0]) >= 2) {
                $results = [];
                for ($i = 0; $i < count($matches[0]); $i++) {
                    $letter = !empty($matches[1][$i][0]) ? $matches[1][$i][0] : $matches[2][$i][0];
                    $startPos = $matches[0][$i][1] + strlen($matches[0][$i][0]);
                    $endPos = isset($matches[0][$i + 1]) ? $matches[0][$i + 1][1] : strlen($text);
                    $choiceText = trim(substr($text, $startPos, $endPos - $startPos));
                    $results[] = [
                        'letter' => $letter,
                        'text' => $choiceText,
                    ];
                }
                return $results;
            }
        }
        return [];
    }

    /**
     * Fallback parser for unstructured text.
     */
    protected function fallbackParseText(array $blocks): array
    {
        $allText = '';
        foreach ($blocks as $b) {
            $allText .= $b['text'] . "\n";
        }

        $allText = trim($allText);
        if ($allText === '') {
            return [];
        }

        // Try splitting by double newline
        $chunks = preg_split('/\n\s*\n/', $allText);
        $questions = [];

        foreach ($chunks as $chunk) {
            $lines = array_filter(array_map('trim', explode("\n", $chunk)), fn($l) => !empty($l));
            if (empty($lines)) continue;

            $qText = array_shift($lines);
            $options = [];
            $correctAns = '';

            foreach ($lines as $line) {
                $choice = $this->parseChoiceLine($line);
                if ($choice) {
                    $options[] = ['text' => $choice['text'], 'image_url' => null];
                } elseif (preg_match('/^(?:الإجابة|الحل|Answer)[\s:：]+(.*)$/ui', $line, $m)) {
                    $correctAns = trim($m[1]);
                }
            }

            $type = count($options) > 0 ? 'mcq' : 'essay';
            $questions[] = [
                'text' => $qText,
                'image_url' => null,
                'type' => $type,
                'options' => $type === 'mcq' ? $options : null,
                'correct_answer' => $correctAns,
                'score' => 1,
            ];
        }

        return $questions;
    }
}
