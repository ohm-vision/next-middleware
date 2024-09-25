import type { NextRequest } from "next/server";
import type { NextMiddleware } from "./next-middleware.type";
import type { NextMiddlewareMatcher } from "./next-middleware-matcher.type";

export type NextMiddlewareWithMatcher<TRequest extends NextRequest = NextRequest> = {
    middleware: NextMiddleware<TRequest>;
    matcher: NextMiddlewareMatcher<TRequest> | NextMiddlewareMatcher<TRequest>[];
};
