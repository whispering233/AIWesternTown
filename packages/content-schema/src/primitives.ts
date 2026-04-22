import { z } from "zod";

export const identifierSchema = z.string().min(1);
export const nonEmptyStringSchema = z.string().min(1);
export const tagsSchema = z.array(nonEmptyStringSchema);

export type Identifier = z.infer<typeof identifierSchema>;
