<?php

namespace App\Services;

class TelegramPhoneService
{
    /**
     * Normalize raw phone number string to canonical local Egyptian (01xxxxxxxxx)
     * or standard clean representation.
     */
    public static function normalize(string $rawPhone): string
    {
        $clean = trim($rawPhone);
        // Remove spaces, hyphens, parentheses, and dots
        $clean = preg_replace('/[\s\-\(\)\.]/', '', $clean);

        // Remove international Egyptian prefixes (+20, 0020, 20)
        if (str_starts_with($clean, '+20')) {
            $clean = substr($clean, 3);
        } elseif (str_starts_with($clean, '0020')) {
            $clean = substr($clean, 4);
        } elseif (str_starts_with($clean, '20') && strlen($clean) === 12 && str_starts_with(substr($clean, 2), '1')) {
            $clean = substr($clean, 2);
        }

        // Ensure leading 0 for standard 11-digit Egyptian mobile (010, 011, 012, 015)
        if (strlen($clean) === 10 && str_starts_with($clean, '1')) {
            $clean = '0' . $clean;
        }

        return $clean;
    }

    /**
     * Get all possible search variants of a phone number to match against the DB.
     * Accommodates different formats entered by students during registration.
     */
    public static function getSearchVariants(string $rawPhone): array
    {
        $local = self::normalize($rawPhone);
        $variants = [$local];

        // If local is 11-digit Egyptian mobile (e.g. 01012345678)
        if (strlen($local) === 11 && str_starts_with($local, '01')) {
            $withoutZero = substr($local, 1); // 1012345678
            $variants[] = '+20' . $withoutZero;  // +201012345678
            $variants[] = '20' . $withoutZero;   // 201012345678
            $variants[] = '0020' . $withoutZero; // 00201012345678
            $variants[] = $withoutZero;          // 1012345678
        } else {
            // General international variant
            $digitsOnly = preg_replace('/\D/', '', $rawPhone);
            if (!empty($digitsOnly)) {
                $variants[] = $digitsOnly;
                $variants[] = '+' . $digitsOnly;
            }
        }

        return array_values(array_unique(array_filter($variants)));
    }

    /**
     * Validate whether a phone number is a valid Egyptian mobile format.
     */
    public static function isValidEgyptianMobile(string $phone): bool
    {
        $local = self::normalize($phone);
        return (bool) preg_match('/^01[0125][0-9]{8}$/', $local);
    }
}
