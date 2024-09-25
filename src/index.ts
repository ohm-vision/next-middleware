import {
    type NextFetchEvent,
    type NextRequest,
    NextResponse,
} from "next/server";

import type { NextMiddleware, NextMiddlewareProps } from "./types/next-middleware.type";
import type { NextMiddlewareWithMatcher } from "./types/next-middleware-with-matcher.type";

import { composeMatchers } from "./utils/matcher.util";

// export types
export * from "./types/next-middleware.type";
export * from "./types/next-middleware-with-matcher.type";

// export utility functions
export * from "./utils/middleware.util";

export type ComposeMiddlewareProps<TRequest extends NextRequest = NextRequest> = 
    NextMiddlewareWithMatcher<TRequest> | NextMiddleware<TRequest> | NextMiddleware;

/**
 * - Registers as many middlwares as needed.
 *
 * - Middlewares are invoked in the order they were registerd.
 *
 * - The first middleware to return the instance of NextResponse breaks the chain.
 *
 * - As in the next docs, middlewares are invoked for every request including next
 *   requests to fetch static assets.

 * @param middlewares 
*/
export function composeMiddlewares<TRequest extends NextRequest = NextRequest>(...middlewares: ComposeMiddlewareProps<TRequest>[]) {
    const validMiddlewares = middlewares.reduce((acc, props, i) => {
        const middleware = compose(props);

        if (middleware) {
            return [...acc, middleware];
        }

        console.warn(`Trying to register an invalid middleware[${i}]: `, props);
    
        return acc;
      }, [] as NextMiddleware[]);

    return async function ComposedMiddleware(reqOrProps: NextRequest | NextMiddlewareProps, _evt: NextFetchEvent) {
        const nested = "req" in reqOrProps;

        const req = nested ? reqOrProps.req : reqOrProps;
        const res = nested ? reqOrProps.res : NextResponse.next();
        const evt = nested ? reqOrProps.evt : _evt;

        const props: NextMiddlewareProps = {
            req, res, evt
        };

        for (const middleware of validMiddlewares) {
            const result = await middleware(props, evt);
  
            if (!!result) {
                return result;
            }
        }

        // if this middleware was nested somewhere, we need to prevent a return
        // otherwise, the chain of other responses will break
        if (nested) {
            return;
        }

        return res;
    };
}


function compose(props: ComposeMiddlewareProps<any>) {
    let fn: NextMiddleware<any>;

    if (typeof props === "function") {
        fn = props;
    } else if (typeof props?.middleware === "function") {
        fn = composeConfig(props);
    }

    return fn;
}

function composeConfig({ matcher, middleware }: NextMiddlewareWithMatcher) {
    const matcherFn = composeMatchers(matcher);

    if (!matcherFn) return middleware;

    return async function ConfigMiddleware(props: NextMiddlewareProps, evt: NextFetchEvent) {
        const { req } = props;

        const isValid = await matcherFn(req);

        if (isValid) {
            return await middleware(props, evt);
        }
    }
}
