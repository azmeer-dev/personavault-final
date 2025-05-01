// middleware.ts
import { withAuth } from "next-auth/middleware";

export default withAuth(
  () => {
    // you can inspect req.nextUrl.pathname here
  },
  {
    pages: {
      signIn: "/signin",
    },
  }
);

export const config = {
  matcher: [
    "/((?!signin|api|_next/static|favicon.ico).*)",
  ],
};
