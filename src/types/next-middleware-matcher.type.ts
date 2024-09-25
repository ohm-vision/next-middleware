import type { NextRequest } from "next/server";
import type { Middleware } from "next/dist/lib/load-custom-routes";

export type NextMiddlewareMatcherFunction<TRequest extends NextRequest = NextRequest>
    = (req: TRequest) => boolean | Promise<boolean>;

export type NextMiddlewareMatcherConfig = Omit<Middleware, "locale">;

export type NextMiddlewareMatcher<TRequest extends NextRequest = NextRequest> =
    NextMiddlewareMatcherFunction<TRequest> |
    NextMiddlewareMatcherConfig |
    string;
