import type { NextRequest, NextFetchEvent, NextResponse } from "next/server";
import type { NextMiddlewareResult } from "next/dist/server/web/types";

export type NextMiddlewareProps<TRequest extends NextRequest = NextRequest> = {
    readonly req: TRequest;
    readonly res: NextResponse;
    readonly evt: NextFetchEvent
};
/**
 * Extends the existing NextRequest object to support compatible types, returns a standard middleware result
 */
export type NextMiddleware<TRequest extends NextRequest = NextRequest> = (props: NextMiddlewareProps<TRequest>, evt: NextFetchEvent) => Promise<NextMiddlewareResult> | NextMiddlewareResult;
