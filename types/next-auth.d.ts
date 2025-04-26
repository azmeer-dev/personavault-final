import { DefaultSession } from "next-auth";

/**
 *  Module augmentation: extend the built-in types
 */
declare module "next-auth" {
  // add whatever you actually put in the session
  interface Session {
    user: {
      id: string;                 // ✅ new field
    } & DefaultSession["user"];   // 🔗 keep name, email, image
  }

  interface User {                // (optional) what comes from your DB
    id: string;
  }
}
