// middleware.ts
import { withAuth } from "next-auth/middleware";

export default withAuth(
  () => {
  },
  {
    pages: {
      signIn: "/signin", //callback page for when user tries to access protected route
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/connected-accounts/:path*",
    "/settings/:path*",
    "/identities/:path*"
  ],
};

