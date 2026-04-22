import { z } from "zod";

export const identifierSchema = z.string().min(1);
export const tickSchema = z.number().int().nonnegative();
export const tagSchema = z.string().min(1);
export const tagsSchema = z.array(tagSchema);
export const timestampSchema = z.string().min(1);

const jsonLiteralSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null()
]);

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    jsonLiteralSchema,
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema)
  ])
);

export const jsonObjectSchema = z.record(z.string(), jsonValueSchema);
export const metadataSchema = jsonObjectSchema;

export type Identifier = z.infer<typeof identifierSchema>;
export type Tick = z.infer<typeof tickSchema>;
export type Tag = z.infer<typeof tagSchema>;
export type Metadata = z.infer<typeof metadataSchema>;
