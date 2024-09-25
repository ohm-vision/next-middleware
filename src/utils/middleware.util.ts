import type { NextRequest } from "next/server";

export function isPagePathRequest(req: NextRequest) {
    const isNonPagePathPrefix = /^\/(?:_next|api)\//;
    const isFile = /\..*$/;
    const { pathname } = req.nextUrl;

    return !isNonPagePathPrefix.test(pathname) && !isFile.test(pathname);
}
export function isPreviewModeRequest(req: NextRequest) {
    return !!req.cookies.get("__next_preview_data");
}
  
export function isNextJsDataRequest(req: NextRequest) {
    return !!req.headers.get("x-nextjs-data");
}

export function isPageRequest(req: NextRequest) {
    return (
      isPagePathRequest(req) &&
      !isPreviewModeRequest(req) &&
      !isNextJsDataRequest(req)
    );
}
