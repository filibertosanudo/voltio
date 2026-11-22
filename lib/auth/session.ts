import "server-only";
import { cache } from "react";
import { auth } from "@/auth";

/**
 * One session lookup per request, however many layouts, pages and actions
 * ask: the `jwt` callback's revalidation query must not run once per caller.
 */
export const getSession = cache(() => auth());
