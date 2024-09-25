import type { NextRequest } from "next/server";
import type { RouteHas } from "next/dist/lib/load-custom-routes";
import { pathToRegexp } from "path-to-regexp";

import type { NextMiddlewareMatcher, NextMiddlewareMatcherConfig, NextMiddlewareMatcherFunction } from "../types/next-middleware-matcher.type";

export function composeMatchers(matcher: NextMiddlewareMatcher<any> | NextMiddlewareMatcher<any>[]) : NextMiddlewareMatcherFunction<any> {
    let result: NextMiddlewareMatcherFunction;
    if (Array.isArray(matcher)) {
        const matchers = matcher.reduce((acc, props, i) => {
            let fn = compose(props);

            if (typeof fn === "function") {
                acc.push(fn);
            } else {
                console.warn(`Trying to register an invalid matcher[${i}]: `, props);
            }

            return acc;
        }, [] as NextMiddlewareMatcherFunction[]);

        switch (matchers.length) {
            case 0:
                result = null;
                break;
            case 1:
                result = matchers[0];
                break;
            default:
                result = async function ComposedMatchers(req: NextRequest) {
                    let isValid = true;

                    for (let i = 0; i < matchers.length && isValid; i++) {
                        const matcher = matchers[0];

                        isValid &&= await matcher(req);
                    }

                    return isValid;
                }
                break;
        }
    } else if (matcher) {
        result = compose(matcher);
    } else {
        result = null;
    }

    return result;
}

//- composers
function compose(matcher: NextMiddlewareMatcher) {
    let result: NextMiddlewareMatcherFunction;
    if (typeof matcher === "function") {
        result = matcher;
    } else if (typeof matcher === "string") {
        result = composeString(matcher);
    } else if (isMiddlewareMatcherConfig(matcher)) {
        result = composeConfig(matcher);
    }

    return result;
}

function composeString(matcher: string) {
    if (!matcher.startsWith("/")) {
        throw new Error(`[middleware] Matcher string <${matcher}> MUST start with a "/"`);
    }

    /**
     * 
Configured matchers:

MUST start with /
Can include named parameters: /about/:path matches /about/a and /about/b but not /about/a/c
Can have modifiers on named parameters (starting with :): /about/:path* matches /about/a/b/c because * is zero or more. ? is zero or one and + one or more
Can use regular expression enclosed in parenthesis: /about/(.*) is the same as /about/:path*
    */
    const { regexp } = pathToRegexp(matcher);
    return function NextStringMatcher(req: NextRequest) {
        const isValid = regexp.test(req.nextUrl.pathname);

        return isValid;
    }
}

function composeConfig({ source, has, missing }: NextMiddlewareMatcherConfig) {
    const validHas: RouteHas[] = [];
    if (Array.isArray(has)) {
        has.reduce(accumulateRouteHas, validHas);
    } else if (has) {
        accumulateRouteHas(validHas, has, 0);
    }

    const validMissing: RouteHas[] = [];
    if (Array.isArray(missing)) {
        missing.reduce(accumulateRouteHas, validMissing);
    } else if (missing) {
        accumulateRouteHas(validMissing, missing, 0);
    }

    const doHas = validHas.length > 0;
    const doMissing = validMissing.length > 0;

    const sourceFn = composeString(source);

    if (!doHas && !doMissing) {
        return sourceFn;
    }

    return function NextConfigMatcher(req: NextRequest) {
        const {
            nextUrl: {
                host
                , searchParams
            }
            , headers
            , cookies
        } = req;

        let isValid = sourceFn(req);

        if (doHas) {
            isValid &&= validHas
                .every(has);
        }

        if (doMissing) {
            isValid &&= validMissing
                .every(missing);
        }

        function has({ type, key, value: checkValue }: RouteHas) {
            const value: string = resolveRouteHas(type, key);

            let result: boolean = !!value;

            if (checkValue) {
                result &&= value === checkValue;
            }

            return result;
        }

        function missing({ type, key }: RouteHas) {
            const value: string = resolveRouteHas(type, key);

            let result: boolean = !value;

            return result;
        }

        function resolveRouteHas(type: RouteHas["type"], key: string) {
            let value: string;
            switch (type) {
                case "header":
                    value = headers.get(key);
                    break;
                case "cookie":
                    value = cookies.get(key)?.value;
                    break;
                case "host":
                    value = host;
                    break
                case "query":
                    value = searchParams.get(key);
                    break;
                default:
                    throw new Error(`Unable to resolve ${type} -> ${key}`);
            }

            return value;
        }

        return isValid;
    }
}

//- accumulators
function accumulateRouteHas(
    acc: RouteHas[],
    props: RouteHas,
    index: number) {
    if (!!props && typeof props === "object") {
        const { type, key, value } = props;

        let isValid = false;
        switch (type) {
            case "cookie":
            case "header":
            case "query":
                isValid = typeof key === "string";
                break;
            case "host":
                isValid = typeof value === "string";
                break;
        }

        if (isValid) {
            return [...acc, props];
        }
    }

    console.warn(`Invalid RouteHas clause [${index}]`, props);
    return acc;
}

//- utils
function isMiddlewareMatcherConfig(v: unknown) : v is NextMiddlewareMatcherConfig {
    return typeof v === "object" && "source" in v && typeof (v as any).source === "string";
}
