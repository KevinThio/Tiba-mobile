// Loads .env / .env.local the same way Next.js does. Import first in every script.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
