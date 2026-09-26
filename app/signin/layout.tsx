import { SiteFooter } from "@/components/site-footer";

/* Logging in is a task: the pages under /signin close with the slim footer. */
export default function SignInLayout({ children }: LayoutProps<"/signin">) {
  return (
    <>
      {children}
      <SiteFooter variant="slim" />
    </>
  );
}
