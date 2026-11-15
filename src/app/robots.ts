import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: ["/", "/infinite", "/hangul", "/challenge", "/classic", "/classic/daily"],
            disallow: ["/admin"]
        },
        sitemap: 'https://idolguessr.fun/sitemap.xml'
    }
}
