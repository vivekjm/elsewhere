/**
 * The family (view-only) link: https://tripsloom.com/f/<code>. Same page as the Trip Room, on its own path so the
 * app's universal link (which covers /t/* only) never tries to join with it.
 */
export { default, generateMetadata } from "../../t/[code]/page";
