import { z } from "zod";
/**
 * Stable identifiers used by the Kids player, authoring tools, and progress
 * services.  Content is intentionally declarative: renderers receive data,
 * never executable behaviour.
 */
export declare const kidsActivityTypeSchema: z.ZodEnum<["matching", "tracing", "media_choice", "counting", "ordering_puzzle"]>;
export type KidsActivityType = z.infer<typeof kidsActivityTypeSchema>;
/** Opaque first-party object key; clients must resolve it through their asset service. */
export declare const kidsAssetKeySchema: z.ZodString;
export declare const kidsMediaSchema: z.ZodObject<{
    kind: z.ZodEnum<["image", "audio"]>;
    assetKey: z.ZodString;
    alt: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    kind: "image" | "audio";
    assetKey: string;
    alt?: string | undefined;
}, {
    kind: "image" | "audio";
    assetKey: string;
    alt?: string | undefined;
}>;
export declare const matchingActivitySchema: z.ZodObject<{
    id: z.ZodString;
    skillId: z.ZodString;
    title: z.ZodString;
    instructions: z.ZodString;
    exampleId: z.ZodString;
    weight: z.ZodDefault<z.ZodNumber>;
} & {
    type: z.ZodLiteral<"matching">;
    pairs: z.ZodEffects<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        left: z.ZodString;
        right: z.ZodString;
        leftMedia: z.ZodOptional<z.ZodObject<{
            kind: z.ZodEnum<["image", "audio"]>;
            assetKey: z.ZodString;
            alt: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        }, {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        }>>;
        rightMedia: z.ZodOptional<z.ZodObject<{
            kind: z.ZodEnum<["image", "audio"]>;
            assetKey: z.ZodString;
            alt: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        }, {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        }>>;
    }, "strict", z.ZodTypeAny, {
        id: string;
        left: string;
        right: string;
        leftMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
        rightMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }, {
        id: string;
        left: string;
        right: string;
        leftMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
        rightMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }>, "many">, {
        id: string;
        left: string;
        right: string;
        leftMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
        rightMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[], {
        id: string;
        left: string;
        right: string;
        leftMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
        rightMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[]>;
}, "strict", z.ZodTypeAny, {
    type: "matching";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    weight: number;
    pairs: {
        id: string;
        left: string;
        right: string;
        leftMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
        rightMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[];
}, {
    type: "matching";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    pairs: {
        id: string;
        left: string;
        right: string;
        leftMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
        rightMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[];
    weight?: number | undefined;
}>;
export declare const tracingActivitySchema: z.ZodObject<{
    id: z.ZodString;
    skillId: z.ZodString;
    title: z.ZodString;
    instructions: z.ZodString;
    exampleId: z.ZodString;
    weight: z.ZodDefault<z.ZodNumber>;
} & {
    type: z.ZodLiteral<"tracing">;
    strokes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        points: z.ZodArray<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
        }, {
            x: number;
            y: number;
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        id: string;
        points: {
            x: number;
            y: number;
        }[];
    }, {
        id: string;
        points: {
            x: number;
            y: number;
        }[];
    }>, "many">;
    completionThreshold: z.ZodDefault<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    type: "tracing";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    weight: number;
    strokes: {
        id: string;
        points: {
            x: number;
            y: number;
        }[];
    }[];
    completionThreshold: number;
}, {
    type: "tracing";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    strokes: {
        id: string;
        points: {
            x: number;
            y: number;
        }[];
    }[];
    weight?: number | undefined;
    completionThreshold?: number | undefined;
}>;
export declare const mediaChoiceActivitySchema: z.ZodObject<{
    id: z.ZodString;
    skillId: z.ZodString;
    title: z.ZodString;
    instructions: z.ZodString;
    exampleId: z.ZodString;
    weight: z.ZodDefault<z.ZodNumber>;
} & {
    type: z.ZodLiteral<"media_choice">;
    prompt: z.ZodString;
    promptMedia: z.ZodOptional<z.ZodObject<{
        kind: z.ZodEnum<["image", "audio"]>;
        assetKey: z.ZodString;
        alt: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        kind: "image" | "audio";
        assetKey: string;
        alt?: string | undefined;
    }, {
        kind: "image" | "audio";
        assetKey: string;
        alt?: string | undefined;
    }>>;
    choices: z.ZodEffects<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        media: z.ZodObject<{
            kind: z.ZodEnum<["image", "audio"]>;
            assetKey: z.ZodString;
            alt: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        }, {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        }>;
        isCorrect: z.ZodBoolean;
    }, "strict", z.ZodTypeAny, {
        id: string;
        label: string;
        media: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        };
        isCorrect: boolean;
    }, {
        id: string;
        label: string;
        media: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        };
        isCorrect: boolean;
    }>, "many">, {
        id: string;
        label: string;
        media: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        };
        isCorrect: boolean;
    }[], {
        id: string;
        label: string;
        media: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        };
        isCorrect: boolean;
    }[]>;
}, "strict", z.ZodTypeAny, {
    type: "media_choice";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    weight: number;
    prompt: string;
    choices: {
        id: string;
        label: string;
        media: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        };
        isCorrect: boolean;
    }[];
    promptMedia?: {
        kind: "image" | "audio";
        assetKey: string;
        alt?: string | undefined;
    } | undefined;
}, {
    type: "media_choice";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    prompt: string;
    choices: {
        id: string;
        label: string;
        media: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        };
        isCorrect: boolean;
    }[];
    weight?: number | undefined;
    promptMedia?: {
        kind: "image" | "audio";
        assetKey: string;
        alt?: string | undefined;
    } | undefined;
}>;
export declare const countingActivitySchema: z.ZodEffects<z.ZodObject<{
    id: z.ZodString;
    skillId: z.ZodString;
    title: z.ZodString;
    instructions: z.ZodString;
    exampleId: z.ZodString;
    weight: z.ZodDefault<z.ZodNumber>;
} & {
    type: z.ZodLiteral<"counting">;
    prompt: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        media: z.ZodOptional<z.ZodObject<{
            kind: z.ZodEnum<["image", "audio"]>;
            assetKey: z.ZodString;
            alt: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        }, {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        }>>;
        label: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        id: string;
        label?: string | undefined;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }, {
        id: string;
        label?: string | undefined;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }>, "many">;
    correctCount: z.ZodNumber;
    choices: z.ZodArray<z.ZodNumber, "many">;
}, "strict", z.ZodTypeAny, {
    type: "counting";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    weight: number;
    prompt: string;
    choices: number[];
    items: {
        id: string;
        label?: string | undefined;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[];
    correctCount: number;
}, {
    type: "counting";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    prompt: string;
    choices: number[];
    items: {
        id: string;
        label?: string | undefined;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[];
    correctCount: number;
    weight?: number | undefined;
}>, {
    type: "counting";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    weight: number;
    prompt: string;
    choices: number[];
    items: {
        id: string;
        label?: string | undefined;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[];
    correctCount: number;
}, {
    type: "counting";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    prompt: string;
    choices: number[];
    items: {
        id: string;
        label?: string | undefined;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[];
    correctCount: number;
    weight?: number | undefined;
}>;
export declare const orderingPuzzleActivitySchema: z.ZodEffects<z.ZodObject<{
    id: z.ZodString;
    skillId: z.ZodString;
    title: z.ZodString;
    instructions: z.ZodString;
    exampleId: z.ZodString;
    weight: z.ZodDefault<z.ZodNumber>;
} & {
    type: z.ZodLiteral<"ordering_puzzle">;
    prompt: z.ZodString;
    pieces: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        media: z.ZodOptional<z.ZodObject<{
            kind: z.ZodEnum<["image", "audio"]>;
            assetKey: z.ZodString;
            alt: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        }, {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        }>>;
        correctPosition: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        id: string;
        label: string;
        correctPosition: number;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }, {
        id: string;
        label: string;
        correctPosition: number;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    type: "ordering_puzzle";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    weight: number;
    prompt: string;
    pieces: {
        id: string;
        label: string;
        correctPosition: number;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[];
}, {
    type: "ordering_puzzle";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    prompt: string;
    pieces: {
        id: string;
        label: string;
        correctPosition: number;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[];
    weight?: number | undefined;
}>, {
    type: "ordering_puzzle";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    weight: number;
    prompt: string;
    pieces: {
        id: string;
        label: string;
        correctPosition: number;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[];
}, {
    type: "ordering_puzzle";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    prompt: string;
    pieces: {
        id: string;
        label: string;
        correctPosition: number;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[];
    weight?: number | undefined;
}>;
export declare const kidsActivitySchema: z.ZodUnion<[z.ZodObject<{
    id: z.ZodString;
    skillId: z.ZodString;
    title: z.ZodString;
    instructions: z.ZodString;
    exampleId: z.ZodString;
    weight: z.ZodDefault<z.ZodNumber>;
} & {
    type: z.ZodLiteral<"matching">;
    pairs: z.ZodEffects<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        left: z.ZodString;
        right: z.ZodString;
        leftMedia: z.ZodOptional<z.ZodObject<{
            kind: z.ZodEnum<["image", "audio"]>;
            assetKey: z.ZodString;
            alt: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        }, {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        }>>;
        rightMedia: z.ZodOptional<z.ZodObject<{
            kind: z.ZodEnum<["image", "audio"]>;
            assetKey: z.ZodString;
            alt: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        }, {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        }>>;
    }, "strict", z.ZodTypeAny, {
        id: string;
        left: string;
        right: string;
        leftMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
        rightMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }, {
        id: string;
        left: string;
        right: string;
        leftMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
        rightMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }>, "many">, {
        id: string;
        left: string;
        right: string;
        leftMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
        rightMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[], {
        id: string;
        left: string;
        right: string;
        leftMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
        rightMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[]>;
}, "strict", z.ZodTypeAny, {
    type: "matching";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    weight: number;
    pairs: {
        id: string;
        left: string;
        right: string;
        leftMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
        rightMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[];
}, {
    type: "matching";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    pairs: {
        id: string;
        left: string;
        right: string;
        leftMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
        rightMedia?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[];
    weight?: number | undefined;
}>, z.ZodObject<{
    id: z.ZodString;
    skillId: z.ZodString;
    title: z.ZodString;
    instructions: z.ZodString;
    exampleId: z.ZodString;
    weight: z.ZodDefault<z.ZodNumber>;
} & {
    type: z.ZodLiteral<"tracing">;
    strokes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        points: z.ZodArray<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
        }, {
            x: number;
            y: number;
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        id: string;
        points: {
            x: number;
            y: number;
        }[];
    }, {
        id: string;
        points: {
            x: number;
            y: number;
        }[];
    }>, "many">;
    completionThreshold: z.ZodDefault<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    type: "tracing";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    weight: number;
    strokes: {
        id: string;
        points: {
            x: number;
            y: number;
        }[];
    }[];
    completionThreshold: number;
}, {
    type: "tracing";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    strokes: {
        id: string;
        points: {
            x: number;
            y: number;
        }[];
    }[];
    weight?: number | undefined;
    completionThreshold?: number | undefined;
}>, z.ZodObject<{
    id: z.ZodString;
    skillId: z.ZodString;
    title: z.ZodString;
    instructions: z.ZodString;
    exampleId: z.ZodString;
    weight: z.ZodDefault<z.ZodNumber>;
} & {
    type: z.ZodLiteral<"media_choice">;
    prompt: z.ZodString;
    promptMedia: z.ZodOptional<z.ZodObject<{
        kind: z.ZodEnum<["image", "audio"]>;
        assetKey: z.ZodString;
        alt: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        kind: "image" | "audio";
        assetKey: string;
        alt?: string | undefined;
    }, {
        kind: "image" | "audio";
        assetKey: string;
        alt?: string | undefined;
    }>>;
    choices: z.ZodEffects<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        media: z.ZodObject<{
            kind: z.ZodEnum<["image", "audio"]>;
            assetKey: z.ZodString;
            alt: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        }, {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        }>;
        isCorrect: z.ZodBoolean;
    }, "strict", z.ZodTypeAny, {
        id: string;
        label: string;
        media: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        };
        isCorrect: boolean;
    }, {
        id: string;
        label: string;
        media: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        };
        isCorrect: boolean;
    }>, "many">, {
        id: string;
        label: string;
        media: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        };
        isCorrect: boolean;
    }[], {
        id: string;
        label: string;
        media: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        };
        isCorrect: boolean;
    }[]>;
}, "strict", z.ZodTypeAny, {
    type: "media_choice";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    weight: number;
    prompt: string;
    choices: {
        id: string;
        label: string;
        media: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        };
        isCorrect: boolean;
    }[];
    promptMedia?: {
        kind: "image" | "audio";
        assetKey: string;
        alt?: string | undefined;
    } | undefined;
}, {
    type: "media_choice";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    prompt: string;
    choices: {
        id: string;
        label: string;
        media: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        };
        isCorrect: boolean;
    }[];
    weight?: number | undefined;
    promptMedia?: {
        kind: "image" | "audio";
        assetKey: string;
        alt?: string | undefined;
    } | undefined;
}>, z.ZodEffects<z.ZodObject<{
    id: z.ZodString;
    skillId: z.ZodString;
    title: z.ZodString;
    instructions: z.ZodString;
    exampleId: z.ZodString;
    weight: z.ZodDefault<z.ZodNumber>;
} & {
    type: z.ZodLiteral<"counting">;
    prompt: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        media: z.ZodOptional<z.ZodObject<{
            kind: z.ZodEnum<["image", "audio"]>;
            assetKey: z.ZodString;
            alt: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        }, {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        }>>;
        label: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        id: string;
        label?: string | undefined;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }, {
        id: string;
        label?: string | undefined;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }>, "many">;
    correctCount: z.ZodNumber;
    choices: z.ZodArray<z.ZodNumber, "many">;
}, "strict", z.ZodTypeAny, {
    type: "counting";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    weight: number;
    prompt: string;
    choices: number[];
    items: {
        id: string;
        label?: string | undefined;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[];
    correctCount: number;
}, {
    type: "counting";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    prompt: string;
    choices: number[];
    items: {
        id: string;
        label?: string | undefined;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[];
    correctCount: number;
    weight?: number | undefined;
}>, {
    type: "counting";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    weight: number;
    prompt: string;
    choices: number[];
    items: {
        id: string;
        label?: string | undefined;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[];
    correctCount: number;
}, {
    type: "counting";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    prompt: string;
    choices: number[];
    items: {
        id: string;
        label?: string | undefined;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[];
    correctCount: number;
    weight?: number | undefined;
}>, z.ZodEffects<z.ZodObject<{
    id: z.ZodString;
    skillId: z.ZodString;
    title: z.ZodString;
    instructions: z.ZodString;
    exampleId: z.ZodString;
    weight: z.ZodDefault<z.ZodNumber>;
} & {
    type: z.ZodLiteral<"ordering_puzzle">;
    prompt: z.ZodString;
    pieces: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        media: z.ZodOptional<z.ZodObject<{
            kind: z.ZodEnum<["image", "audio"]>;
            assetKey: z.ZodString;
            alt: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        }, {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        }>>;
        correctPosition: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        id: string;
        label: string;
        correctPosition: number;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }, {
        id: string;
        label: string;
        correctPosition: number;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    type: "ordering_puzzle";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    weight: number;
    prompt: string;
    pieces: {
        id: string;
        label: string;
        correctPosition: number;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[];
}, {
    type: "ordering_puzzle";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    prompt: string;
    pieces: {
        id: string;
        label: string;
        correctPosition: number;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[];
    weight?: number | undefined;
}>, {
    type: "ordering_puzzle";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    weight: number;
    prompt: string;
    pieces: {
        id: string;
        label: string;
        correctPosition: number;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[];
}, {
    type: "ordering_puzzle";
    id: string;
    skillId: string;
    title: string;
    instructions: string;
    exampleId: string;
    prompt: string;
    pieces: {
        id: string;
        label: string;
        correctPosition: number;
        media?: {
            kind: "image" | "audio";
            assetKey: string;
            alt?: string | undefined;
        } | undefined;
    }[];
    weight?: number | undefined;
}>]>;
export type KidsActivity = z.infer<typeof kidsActivitySchema>;
export declare const kidsAttemptSchema: z.ZodEffects<z.ZodObject<{
    activityId: z.ZodString;
    activityType: z.ZodEnum<["matching", "tracing", "media_choice", "counting", "ordering_puzzle"]>;
    skillId: z.ZodString;
    exampleId: z.ZodString;
    sessionId: z.ZodString;
    completedAt: z.ZodDate;
    correctWeight: z.ZodNumber;
    possibleWeight: z.ZodNumber;
    errors: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strict", z.ZodTypeAny, {
    skillId: string;
    exampleId: string;
    activityId: string;
    activityType: "matching" | "tracing" | "media_choice" | "counting" | "ordering_puzzle";
    sessionId: string;
    completedAt: Date;
    correctWeight: number;
    possibleWeight: number;
    errors: string[];
}, {
    skillId: string;
    exampleId: string;
    activityId: string;
    activityType: "matching" | "tracing" | "media_choice" | "counting" | "ordering_puzzle";
    sessionId: string;
    completedAt: Date;
    correctWeight: number;
    possibleWeight: number;
    errors?: string[] | undefined;
}>, {
    skillId: string;
    exampleId: string;
    activityId: string;
    activityType: "matching" | "tracing" | "media_choice" | "counting" | "ordering_puzzle";
    sessionId: string;
    completedAt: Date;
    correctWeight: number;
    possibleWeight: number;
    errors: string[];
}, {
    skillId: string;
    exampleId: string;
    activityId: string;
    activityType: "matching" | "tracing" | "media_choice" | "counting" | "ordering_puzzle";
    sessionId: string;
    completedAt: Date;
    correctWeight: number;
    possibleWeight: number;
    errors?: string[] | undefined;
}>;
export type KidsAttempt = z.infer<typeof kidsAttemptSchema>;
export declare const KIDS_MASTERY_REQUIREMENTS: {
    readonly minAttempts: 5;
    readonly minimumWeightedAccuracy: 0.8;
    readonly minActivityTypes: 2;
    readonly minSessions: 2;
    readonly minExamples: 3;
};
export type KidsMasteryState = "not_started" | "practising" | "mastered";
export interface KidsMastery {
    state: KidsMasteryState;
    weightedAccuracy: number;
    attempts: number;
    activityTypes: number;
    sessions: number;
    examples: number;
    unmetRequirements: (keyof typeof KIDS_MASTERY_REQUIREMENTS)[];
}
/** Evaluates only the supplied skill's work, so callers may pass a full history. */
export declare function evaluateKidsMastery(skillId: string, attempts: readonly KidsAttempt[]): KidsMastery;
export interface KidsAdventureCandidate {
    activity: KidsActivity;
    /** Higher values indicate that the learner needs more practice with this skill. */
    need?: number;
}
export interface KidsAdventureSelection {
    activities: KidsActivity[];
    reasons: Record<string, "errors" | "need" | "last_practice">;
}
/**
 * Selects a short, varied adventure. Recent errors outrank unmet need; among
 * otherwise equal activities, the least recently practised one comes first.
 */
export declare function selectKidsAdventure(candidates: readonly KidsAdventureCandidate[], attempts: readonly KidsAttempt[], now?: Date): KidsAdventureSelection;
//# sourceMappingURL=hasaad-kids-learning.d.ts.map