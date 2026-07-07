// Twitter card = the OG card. `runtime` must be a literal here so Next can
// statically detect it (a re-exported const is not recognized); the rest of the
// route contract is re-exported from the sibling opengraph-image.
export const runtime = "nodejs";

export {
  default,
  alt,
  size,
  contentType,
  generateStaticParams,
} from "./opengraph-image";
