import { useEffect } from 'react'

interface SEOProps {
  title: string
  description?: string
  keywords?: string
  ogImage?: string
  ogType?: string
  canonicalUrl?: string
  schema?: Record<string, any>
}

export default function SEO({
  title,
  description,
  keywords,
  ogImage,
  ogType = 'website',
  canonicalUrl,
  schema,
}: SEOProps) {
  useEffect(() => {
    // 1. Title
    const brandSuffix = ' | منصة خطوتك'
    const fullTitle = title.includes('خطوتك') ? title : `${title}${brandSuffix}`
    document.title = fullTitle

    // Helper to set/create meta tags
    const setMetaTag = (name: string, content: string, isProperty = false) => {
      const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`
      let element = document.head.querySelector(selector)
      if (element) {
        element.setAttribute('content', content)
      } else {
        element = document.createElement('meta')
        element.setAttribute(isProperty ? 'property' : 'name', name)
        element.setAttribute('content', content)
        document.head.appendChild(element)
      }
    }

    // Helper to set canonical link
    const setCanonicalLink = (url: string) => {
      let element = document.head.querySelector('link[rel="canonical"]')
      if (element) {
        element.setAttribute('href', url)
      } else {
        element = document.createElement('link')
        element.setAttribute('rel', 'canonical')
        element.setAttribute('href', url)
        document.head.appendChild(element)
      }
    }

    // 2. Description
    const finalDesc = description || 'خطوتك هي أول خطوة نحو النجاح، منصة تعليمية حديثة توفر محاضرات تفاعلية واختبارات ومتابعة مستمرة للطلاب في جميع المراحل الثانوية.'
    setMetaTag('description', finalDesc)
    setMetaTag('og:description', finalDesc, true)
    setMetaTag('twitter:description', finalDesc)

    // 3. Keywords
    const finalKeywords = keywords || 'خطوتك, منصة خطوتك, منصة تعليمية, كيمياء ثانوية عامة, فيزياء ثانوية عامة, كورسات اونلاين'
    setMetaTag('keywords', finalKeywords)

    // 4. Open Graph & Twitter Title
    setMetaTag('og:title', fullTitle, true)
    setMetaTag('twitter:title', fullTitle)

    // 5. Image
    const finalImg = ogImage || '/og-image.jpg'
    const absoluteImgUrl = finalImg.startsWith('http') ? finalImg : `${window.location.origin}${finalImg}`
    setMetaTag('og:image', absoluteImgUrl, true)
    setMetaTag('twitter:image', absoluteImgUrl)

    // 6. Type
    setMetaTag('og:type', ogType, true)

    // 7. URL
    const finalUrl = canonicalUrl || window.location.href
    setMetaTag('og:url', finalUrl, true)
    setCanonicalLink(finalUrl)

    // 8. Schema.org JSON-LD structured data
    let script = document.head.querySelector('script[data-schema="seo"]') as HTMLScriptElement | null
    if (schema) {
      if (!script) {
        script = document.createElement('script')
        script.setAttribute('type', 'application/ld+json')
        script.setAttribute('data-schema', 'seo')
        document.head.appendChild(script)
      }
      script.textContent = JSON.stringify(schema)
    } else {
      if (script) {
        script.remove()
      }
    }

    return () => {
      // Clean up dynamic schema script on unmount
      const existingScript = document.head.querySelector('script[data-schema="seo"]')
      if (existingScript) {
        existingScript.remove()
      }
    }
  }, [title, description, keywords, ogImage, ogType, canonicalUrl, schema])

  return null
}
