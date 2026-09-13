declare module "*.mdx" {
  const MDXContent: import("react").ComponentType<import("mdx/types").MDXProps>;
  export default MDXContent;
}
