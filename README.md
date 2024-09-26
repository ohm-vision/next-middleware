# next-middleware
Wrapper for NextJS App Router middleware

This wrapper will allow for middleware composition

> Note: This library has only been tested in Next v14+

> **YOU PROBABLY DON'T NEED THIS LIBRARY**
> 
> If you just have a single middleware, you don't need this
> 
> If you are doing complicated work in your middleware, you don't need this

[![npm version](https://badge.fury.io/js/@ohm-vision%2Fnext-apiroute.svg)](https://badge.fury.io/js/@ohm-vision%2Fnext-middleware)

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/1kom)

## Installation
Run the following command
```
npm install @ohm-vision/next-middleware
```

## Usage
[NextJS Documentation](https://nextjs.org/docs/app/building-your-application/routing/middleware)

Create a `middleware.ts` or `middleware.js` file in your project directory (be sure to place it in the `src` directory if used)

Import the `composeMiddlewares` function from `@ohm-vision/next-middleware`

The function accepts a list of either middleware functions or middleware with matcher configurations

> Middleware are invoked in the order they are registered. The first middleware to return an instance of `NextResponse` or `Response` will short-circuit and break the chain.

Just as in the docs, middlewares are invoked for every request including next requests to fetch static assets. The global config object you export will define all routes which the child middlewares should listen for. If you want the composer to handle all paths, you can either remove the config entirely, or specify the `source` as just `/`

The composer will attempt to "compile" all of the registered middlewares at build-time into a single executing function vs resolve complex configurations dynamically.

To support nesting and fallthrough, a default `NextResponse.next()` object is created prior to all middleware's being run and is passed to each middleware. This will allow you to enrich the response step-by-step vs having one large middleware handle injecting custom locale, theme, or other bits.

If you would like to nest middleware execution (not recommended), you can call the `composeMiddlewares` multiple times as deeply as you'd like. Although I seriously recommend keeping your middleware "tree" as shallow as possible

If you are using middleware for authenticating the user session (such as with `next-auth`), you'll notice that the `composeMiddlewares` function has a type argument to set it to the `NextRequest`-like type which they support. You can also extend this on your own to add additional properties to the request object such as data to be shared by other middlewares

### Next Middleware
Each middleware will be passed the following:

* arg0: (object) - this is the unified object containing
  * req: NextRequest - original `NextRequest` (cast to whatever type you choose)
  * res: NextResponse - default `NextResponse` object
  * evt: NextFetchEvent - original `NextFetchEvent`
* arg1: NextFetchEvent - original `NextFetchEvent`

### Next Middleware With Matcher
We follow the [NextJS documentation](https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher) and support all properties and types except for `locale`.

> Important Note: I had no choice but to omit the `locale` property when in this compose mode as I really have no idea how to facilitate that NextJS magic dynamically. If you have any ideas, please feel free to open a PR

Additionally, I've added support for a dynamic function to return a boolean for more customized middleware matching

I'd probably only recommend using something like this if you're trying to reduce the number of times the path matching is done (ie. a bunch of middleware only runs when authenticated)

I have no doubt there will be a performance impact doing this work relatively dynamically so use them _SPARINGLY_

### Example
```ts
//- @/middlewares/locale.middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { NextMiddlewareProps } from "@ohm-vision/next-middleware";

import { match } from '@formatjs/intl-localematcher'
import Negotiator from 'negotiator'

import defaultLocale, { locales } from "../i18n";

import cookieConfig from "../config/cookie.config";
import headerConfig from "../config/header.config";

export function LocaleMiddleware({ req: { headers, cookies }, res }: NextMiddlewareProps) {
    let locale;

    // Priority 1: Use existing cookie
    if (!locale && cookies && cookies.has(cookieConfig.locale)) {
        const value = cookies.get(cookieConfig.locale)?.value;

        if (value && locales.includes(value)) {
            locale = value;
        }
    }

    // Priority 2: Use `accept-language` header
    if (!locale && headers && headers.has(headerConfig.acceptLanguage)) {
        const languages = new Negotiator({
            headers: {
                [headerConfig.acceptLanguage]: headers.get(headerConfig.acceptLanguage)
            }
        }).languages();
        
        try {
            locale = match(languages, locales, defaultLocale);
        } catch {
            // Invalid language
        }
    }

    // Priority 3: Use default locale
    if (!locale) {
        locale = defaultLocale;
    }

    res.headers.set(headerConfig.locale, locale);
}

//- @/middlewares/theme.middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { NextMiddlewareProps } from "@ohm-vision/next-middleware";

import defaultTheme, { isThemeName } from "../themes/types/theme-names.type";

import cookieConfig from "../config/cookie.config";
import headerConfig from "../config/header.config";

export function ThemeMiddleware({ req: { headers, cookies }, res }: NextMiddlewareProps) {
    let theme;

    // Priority 1: Use existing cookie
    if (!theme && cookies && cookies.has(cookieConfig.theme)) {
        const value = cookies.get(cookieConfig.theme)?.value;

        if (value && isThemeName(value)) {
            theme = value;
        }
    }

    // Priority 2: Use `sec-ch-prefers-color-scheme` header
    if (!theme && headers && headers.has(headerConfig.secChPrefersColorScheme)) {
        const value = headers.get(headerConfig.secChPrefersColorScheme);

        if (value && isThemeName(value)) {
            theme = value;
        }
    }

    // Priority 3: Use default
    if (!theme) {
        theme = defaultTheme;
    }

    res.headers.set(headerConfig.theme, theme);
}

//- @/middlewares/analytics.middleware.ts
import { NextMiddlewareProps } from "@ohm-vision/next-middleware";
 
export function AnalyticsMiddleware({ req, evt }: NextMiddlewareProps) {
  evt.waitUntil(
    fetch('https://my-analytics-platform.com', {
      method: 'POST',
      body: JSON.stringify({ pathname: req.nextUrl.pathname }),
    })
  );
}

//- @/middlewares/cors.middleware.ts
import { NextRequest, NextResponse } from 'next/server'
 
const allowedOrigins = ['https://acme.com', 'https://my-app.org']
 
const corsOptions = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}
 
export function CorsMiddleware({ req, res }: NextMiddlewareProps) {
  // Check the origin from the request
  const origin = req.headers.get('origin') ?? ''
  const isAllowedOrigin = allowedOrigins.includes(origin)
 
  // Handle preflighted requests
  const isPreflight = req.method === 'OPTIONS'
 
  if (isPreflight) {
    const preflightHeaders = {
      ...(isAllowedOrigin && { 'Access-Control-Allow-Origin': origin }),
      ...corsOptions,
    }
    return NextResponse.json({}, { headers: preflightHeaders })
  }
 
  // Handle simple requests
  if (isAllowedOrigin) {
    res.headers.set('Access-Control-Allow-Origin', origin)
  }
 
  Object.entries(corsOptions).forEach(([key, value]) => {
    res.headers.set(key, value)
  });
}

//- @/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { composeMiddleware } from "@ohm-vision/next-middleware";

import { LocaleMiddleware } from "@/middlewares/locale.middleware.ts";
import { AnalyticsMiddleware } from "@/middlewares/analytics.middleware.ts";
import { ThemeMiddleware } from "@/middlewares/theme.middleware.ts";
import { CorsMiddleware } from "@/middlewares/cors.middleware.ts";

export const middleware = composeMiddleware(
    {
        // this middleware will only fire for API routes
        middleware: CorsMiddleware
        matcher: '/api/:path*'
    },
    AnalyticsMiddleware,
    LocaleMiddleware,
    ThemeMiddleware,
    {
        // experimentally nest middleware which share the same matcher
        matcher: "/dashboard",
        // customized request object which the AuthMiddleware will enrich
        middleware: composeMiddleware<NextRequest & {
            auth: {
                roles: string[]
            }
        }>(
            async ({ req }) => {
                const { cookies } = req;

                if (!cookies.has("Session")) return NextResponse.redirect("/login");

                const session = cookies.get("Session");

                // todo: validate session in db, or decode/validate JWT

                // todo: assign roles based on the JWT
                req.auth.roles = ["blogs"];
            },
            {
                // dynamic matcher function
                matcher: ({ req }) => req.pathname.startsWith("/dashboard/blogs"),
                middleware: async ({ req }) => {
                    // if the user does not have the "blogs" role, redirect them to a restricted error page
                    if (!req.auth.roles.includes("blogs")) {
                        return NextResponse.redirect("/dashboard/restricted");
                    }
                }
            }


        )
    }
    //- ... and many more
);

export const config = {
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    matcher: "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"
};
```

## Contact Me
[Ohm Vision, Inc](https://ohmvision.com)
