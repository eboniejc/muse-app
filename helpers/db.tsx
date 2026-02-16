import { type GeneratedAlways, Kysely, CamelCasePlugin } from "kysely";
import { PostgresJSDialect } from "kysely-postgres-js";
import { DB } from "./schema";
import postgres from "postgres";

let _db: Kysely<DB> | any;

try {
	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL is not set");
	}

	_db = new Kysely<DB>({
		plugins: [new CamelCasePlugin()],
		dialect: new PostgresJSDialect({
			postgres: postgres(process.env.DATABASE_URL, {
				prepare: false,
				idle_timeout: 10,
				max: 3,
			}),
		}),
	});
} catch (e) {
	console.warn("Database not initialized:", e && (e as Error).message);
	// Provide a proxy that throws helpful errors when used so imports don't fail.
	_db = new Proxy(
		{},
		{
			get() {
				throw new Error(
					"Database is not configured. Set DATABASE_URL to enable DB features."
				);
			},
		}
	);
}

export const db = _db;