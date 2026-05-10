import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import type { AdminTeacherSummary, Assignment, AssignmentWithQuestions, AuthResponse, BriefPreferences, BuildPresentationRequest, BuildPresentationResponse, CancelBuildResponse, CreateAssignmentBody, CreatePresentationBody, ErrorResponse, ExamSessionResponse, GetPresentationLinkedActivity200, GoogleLoginBody, HealthStatus, LinkPresentationActivity200, LinkPresentationActivityBody, ListAssignmentsParams, LoginTeacherBody, Presentation, PresentationAiLimits, PresentationAsset, PresentationBrief, PresentationDraft, PresentationDraftWithGuardrails, PresentationSummary, PresentationTier, PresentationTierWithUsage, RegisterAssetBody, RegisterTeacherBody, RevokeSessionResponse, RevokeSessionsResponse, StartExamBody, Submission, SubmissionDetail, SubmissionResult, SubmitAssignmentBody, SubmitFeedbackBody, SubmitImageBody, SuccessResponse, TeacherProfile, TeacherSession, UpdateAnswerBody, UpdatePresentationBody, UpdatePresentationDraftBody, UpdateProfileBody, UpdateRoleBody, UpdateSubmissionBody } from "./api.schemas";
import { customFetch } from "../custom-fetch";
import type { ErrorType, BodyType } from "../custom-fetch";
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
/**
 * @summary Health check
 */
export declare const getHealthCheckUrl: () => string;
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Register a new teacher
 */
export declare const getRegisterTeacherUrl: () => string;
export declare const registerTeacher: (registerTeacherBody: RegisterTeacherBody, options?: RequestInit) => Promise<AuthResponse>;
export declare const getRegisterTeacherMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof registerTeacher>>, TError, {
        data: BodyType<RegisterTeacherBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof registerTeacher>>, TError, {
    data: BodyType<RegisterTeacherBody>;
}, TContext>;
export type RegisterTeacherMutationResult = NonNullable<Awaited<ReturnType<typeof registerTeacher>>>;
export type RegisterTeacherMutationBody = BodyType<RegisterTeacherBody>;
export type RegisterTeacherMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Register a new teacher
 */
export declare const useRegisterTeacher: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof registerTeacher>>, TError, {
        data: BodyType<RegisterTeacherBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof registerTeacher>>, TError, {
    data: BodyType<RegisterTeacherBody>;
}, TContext>;
/**
 * @summary Teacher login
 */
export declare const getLoginTeacherUrl: () => string;
export declare const loginTeacher: (loginTeacherBody: LoginTeacherBody, options?: RequestInit) => Promise<AuthResponse>;
export declare const getLoginTeacherMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof loginTeacher>>, TError, {
        data: BodyType<LoginTeacherBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof loginTeacher>>, TError, {
    data: BodyType<LoginTeacherBody>;
}, TContext>;
export type LoginTeacherMutationResult = NonNullable<Awaited<ReturnType<typeof loginTeacher>>>;
export type LoginTeacherMutationBody = BodyType<LoginTeacherBody>;
export type LoginTeacherMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Teacher login
 */
export declare const useLoginTeacher: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof loginTeacher>>, TError, {
        data: BodyType<LoginTeacherBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof loginTeacher>>, TError, {
    data: BodyType<LoginTeacherBody>;
}, TContext>;
/**
 * @summary Get current teacher info
 */
export declare const getGetCurrentTeacherUrl: () => string;
export declare const getCurrentTeacher: (options?: RequestInit) => Promise<TeacherProfile>;
export declare const getGetCurrentTeacherQueryKey: () => readonly ["/api/auth/me"];
export declare const getGetCurrentTeacherQueryOptions: <TData = Awaited<ReturnType<typeof getCurrentTeacher>>, TError = ErrorType<ErrorResponse>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCurrentTeacher>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCurrentTeacher>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetCurrentTeacherQueryResult = NonNullable<Awaited<ReturnType<typeof getCurrentTeacher>>>;
export type GetCurrentTeacherQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get current teacher info
 */
export declare function useGetCurrentTeacher<TData = Awaited<ReturnType<typeof getCurrentTeacher>>, TError = ErrorType<ErrorResponse>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCurrentTeacher>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update teacher profile
 */
export declare const getUpdateTeacherProfileUrl: () => string;
export declare const updateTeacherProfile: (updateProfileBody: UpdateProfileBody, options?: RequestInit) => Promise<TeacherProfile>;
export declare const getUpdateTeacherProfileMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTeacherProfile>>, TError, {
        data: BodyType<UpdateProfileBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateTeacherProfile>>, TError, {
    data: BodyType<UpdateProfileBody>;
}, TContext>;
export type UpdateTeacherProfileMutationResult = NonNullable<Awaited<ReturnType<typeof updateTeacherProfile>>>;
export type UpdateTeacherProfileMutationBody = BodyType<UpdateProfileBody>;
export type UpdateTeacherProfileMutationError = ErrorType<void>;
/**
 * @summary Update teacher profile
 */
export declare const useUpdateTeacherProfile: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTeacherProfile>>, TError, {
        data: BodyType<UpdateProfileBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateTeacherProfile>>, TError, {
    data: BodyType<UpdateProfileBody>;
}, TContext>;
/**
 * @summary Change current user's role (teacher ↔ organizer)
 */
export declare const getUpdateTeacherRoleUrl: () => string;
export declare const updateTeacherRole: (updateRoleBody: UpdateRoleBody, options?: RequestInit) => Promise<TeacherProfile>;
export declare const getUpdateTeacherRoleMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTeacherRole>>, TError, {
        data: BodyType<UpdateRoleBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateTeacherRole>>, TError, {
    data: BodyType<UpdateRoleBody>;
}, TContext>;
export type UpdateTeacherRoleMutationResult = NonNullable<Awaited<ReturnType<typeof updateTeacherRole>>>;
export type UpdateTeacherRoleMutationBody = BodyType<UpdateRoleBody>;
export type UpdateTeacherRoleMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Change current user's role (teacher ↔ organizer)
 */
export declare const useUpdateTeacherRole: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTeacherRole>>, TError, {
        data: BodyType<UpdateRoleBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateTeacherRole>>, TError, {
    data: BodyType<UpdateRoleBody>;
}, TContext>;
/**
 * @summary Logout teacher
 */
export declare const getLogoutTeacherUrl: () => string;
export declare const logoutTeacher: (options?: RequestInit) => Promise<SuccessResponse>;
export declare const getLogoutTeacherMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof logoutTeacher>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof logoutTeacher>>, TError, void, TContext>;
export type LogoutTeacherMutationResult = NonNullable<Awaited<ReturnType<typeof logoutTeacher>>>;
export type LogoutTeacherMutationError = ErrorType<unknown>;
/**
 * @summary Logout teacher
 */
export declare const useLogoutTeacher: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof logoutTeacher>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof logoutTeacher>>, TError, void, TContext>;
/**
 * @summary Login or register a teacher using a Google ID token
 */
export declare const getLoginTeacherWithGoogleUrl: () => string;
export declare const loginTeacherWithGoogle: (googleLoginBody: GoogleLoginBody, options?: RequestInit) => Promise<AuthResponse>;
export declare const getLoginTeacherWithGoogleMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof loginTeacherWithGoogle>>, TError, {
        data: BodyType<GoogleLoginBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof loginTeacherWithGoogle>>, TError, {
    data: BodyType<GoogleLoginBody>;
}, TContext>;
export type LoginTeacherWithGoogleMutationResult = NonNullable<Awaited<ReturnType<typeof loginTeacherWithGoogle>>>;
export type LoginTeacherWithGoogleMutationBody = BodyType<GoogleLoginBody>;
export type LoginTeacherWithGoogleMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Login or register a teacher using a Google ID token
 */
export declare const useLoginTeacherWithGoogle: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof loginTeacherWithGoogle>>, TError, {
        data: BodyType<GoogleLoginBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof loginTeacherWithGoogle>>, TError, {
    data: BodyType<GoogleLoginBody>;
}, TContext>;
/**
 * @summary Get the teacher's saved brief preferences
 */
export declare const getGetBriefPreferencesUrl: () => string;
export declare const getBriefPreferences: (options?: RequestInit) => Promise<BriefPreferences>;
export declare const getGetBriefPreferencesQueryKey: () => readonly ["/api/auth/preferences"];
export declare const getGetBriefPreferencesQueryOptions: <TData = Awaited<ReturnType<typeof getBriefPreferences>>, TError = ErrorType<ErrorResponse>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBriefPreferences>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getBriefPreferences>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetBriefPreferencesQueryResult = NonNullable<Awaited<ReturnType<typeof getBriefPreferences>>>;
export type GetBriefPreferencesQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get the teacher's saved brief preferences
 */
export declare function useGetBriefPreferences<TData = Awaited<ReturnType<typeof getBriefPreferences>>, TError = ErrorType<ErrorResponse>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBriefPreferences>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Persist the teacher's brief preferences server-side
 */
export declare const getUpdateBriefPreferencesUrl: () => string;
export declare const updateBriefPreferences: (briefPreferences: BriefPreferences, options?: RequestInit) => Promise<BriefPreferences>;
export declare const getUpdateBriefPreferencesMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateBriefPreferences>>, TError, {
        data: BodyType<BriefPreferences>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateBriefPreferences>>, TError, {
    data: BodyType<BriefPreferences>;
}, TContext>;
export type UpdateBriefPreferencesMutationResult = NonNullable<Awaited<ReturnType<typeof updateBriefPreferences>>>;
export type UpdateBriefPreferencesMutationBody = BodyType<BriefPreferences>;
export type UpdateBriefPreferencesMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Persist the teacher's brief preferences server-side
 */
export declare const useUpdateBriefPreferences: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateBriefPreferences>>, TError, {
        data: BodyType<BriefPreferences>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateBriefPreferences>>, TError, {
    data: BodyType<BriefPreferences>;
}, TContext>;
/**
 * @summary List active sessions for the current teacher
 */
export declare const getListTeacherSessionsUrl: () => string;
export declare const listTeacherSessions: (options?: RequestInit) => Promise<TeacherSession[]>;
export declare const getListTeacherSessionsQueryKey: () => readonly ["/api/auth/sessions"];
export declare const getListTeacherSessionsQueryOptions: <TData = Awaited<ReturnType<typeof listTeacherSessions>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTeacherSessions>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listTeacherSessions>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListTeacherSessionsQueryResult = NonNullable<Awaited<ReturnType<typeof listTeacherSessions>>>;
export type ListTeacherSessionsQueryError = ErrorType<void>;
/**
 * @summary List active sessions for the current teacher
 */
export declare function useListTeacherSessions<TData = Awaited<ReturnType<typeof listTeacherSessions>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTeacherSessions>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Revoke all sessions for the current teacher except the current one
 */
export declare const getRevokeOtherTeacherSessionsUrl: () => string;
export declare const revokeOtherTeacherSessions: (options?: RequestInit) => Promise<RevokeSessionsResponse>;
export declare const getRevokeOtherTeacherSessionsMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof revokeOtherTeacherSessions>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof revokeOtherTeacherSessions>>, TError, void, TContext>;
export type RevokeOtherTeacherSessionsMutationResult = NonNullable<Awaited<ReturnType<typeof revokeOtherTeacherSessions>>>;
export type RevokeOtherTeacherSessionsMutationError = ErrorType<void>;
/**
 * @summary Revoke all sessions for the current teacher except the current one
 */
export declare const useRevokeOtherTeacherSessions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof revokeOtherTeacherSessions>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof revokeOtherTeacherSessions>>, TError, void, TContext>;
/**
 * @summary Revoke a specific session for the current teacher
 */
export declare const getRevokeTeacherSessionUrl: (sid: string) => string;
export declare const revokeTeacherSession: (sid: string, options?: RequestInit) => Promise<RevokeSessionResponse>;
export declare const getRevokeTeacherSessionMutationOptions: <TError = ErrorType<void | ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof revokeTeacherSession>>, TError, {
        sid: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof revokeTeacherSession>>, TError, {
    sid: string;
}, TContext>;
export type RevokeTeacherSessionMutationResult = NonNullable<Awaited<ReturnType<typeof revokeTeacherSession>>>;
export type RevokeTeacherSessionMutationError = ErrorType<void | ErrorResponse>;
/**
 * @summary Revoke a specific session for the current teacher
 */
export declare const useRevokeTeacherSession: <TError = ErrorType<void | ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof revokeTeacherSession>>, TError, {
        sid: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof revokeTeacherSession>>, TError, {
    sid: string;
}, TContext>;
/**
 * @summary List all registered teachers with stats
 */
export declare const getListAllTeachersUrl: () => string;
export declare const listAllTeachers: (options?: RequestInit) => Promise<AdminTeacherSummary[]>;
export declare const getListAllTeachersQueryKey: () => readonly ["/api/admin/teachers"];
export declare const getListAllTeachersQueryOptions: <TData = Awaited<ReturnType<typeof listAllTeachers>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAllTeachers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listAllTeachers>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListAllTeachersQueryResult = NonNullable<Awaited<ReturnType<typeof listAllTeachers>>>;
export type ListAllTeachersQueryError = ErrorType<void>;
/**
 * @summary List all registered teachers with stats
 */
export declare function useListAllTeachers<TData = Awaited<ReturnType<typeof listAllTeachers>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAllTeachers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary List all assignments
 */
export declare const getListAssignmentsUrl: (params?: ListAssignmentsParams) => string;
export declare const listAssignments: (params?: ListAssignmentsParams, options?: RequestInit) => Promise<Assignment[]>;
export declare const getListAssignmentsQueryKey: (params?: ListAssignmentsParams) => readonly ["/api/assignments", ...ListAssignmentsParams[]];
export declare const getListAssignmentsQueryOptions: <TData = Awaited<ReturnType<typeof listAssignments>>, TError = ErrorType<unknown>>(params?: ListAssignmentsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAssignments>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listAssignments>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListAssignmentsQueryResult = NonNullable<Awaited<ReturnType<typeof listAssignments>>>;
export type ListAssignmentsQueryError = ErrorType<unknown>;
/**
 * @summary List all assignments
 */
export declare function useListAssignments<TData = Awaited<ReturnType<typeof listAssignments>>, TError = ErrorType<unknown>>(params?: ListAssignmentsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAssignments>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a new assignment
 */
export declare const getCreateAssignmentUrl: () => string;
export declare const createAssignment: (createAssignmentBody: CreateAssignmentBody, options?: RequestInit) => Promise<Assignment>;
export declare const getCreateAssignmentMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAssignment>>, TError, {
        data: BodyType<CreateAssignmentBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createAssignment>>, TError, {
    data: BodyType<CreateAssignmentBody>;
}, TContext>;
export type CreateAssignmentMutationResult = NonNullable<Awaited<ReturnType<typeof createAssignment>>>;
export type CreateAssignmentMutationBody = BodyType<CreateAssignmentBody>;
export type CreateAssignmentMutationError = ErrorType<unknown>;
/**
 * @summary Create a new assignment
 */
export declare const useCreateAssignment: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAssignment>>, TError, {
        data: BodyType<CreateAssignmentBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createAssignment>>, TError, {
    data: BodyType<CreateAssignmentBody>;
}, TContext>;
/**
 * @summary Get assignment with questions
 */
export declare const getGetAssignmentUrl: (id: number) => string;
export declare const getAssignment: (id: number, options?: RequestInit) => Promise<AssignmentWithQuestions>;
export declare const getGetAssignmentQueryKey: (id: number) => readonly [`/api/assignments/${number}`];
export declare const getGetAssignmentQueryOptions: <TData = Awaited<ReturnType<typeof getAssignment>>, TError = ErrorType<ErrorResponse>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAssignment>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAssignment>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAssignmentQueryResult = NonNullable<Awaited<ReturnType<typeof getAssignment>>>;
export type GetAssignmentQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get assignment with questions
 */
export declare function useGetAssignment<TData = Awaited<ReturnType<typeof getAssignment>>, TError = ErrorType<ErrorResponse>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAssignment>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Delete an assignment
 */
export declare const getDeleteAssignmentUrl: (id: number) => string;
export declare const deleteAssignment: (id: number, options?: RequestInit) => Promise<SuccessResponse>;
export declare const getDeleteAssignmentMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteAssignment>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteAssignment>>, TError, {
    id: number;
}, TContext>;
export type DeleteAssignmentMutationResult = NonNullable<Awaited<ReturnType<typeof deleteAssignment>>>;
export type DeleteAssignmentMutationError = ErrorType<unknown>;
/**
 * @summary Delete an assignment
 */
export declare const useDeleteAssignment: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteAssignment>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteAssignment>>, TError, {
    id: number;
}, TContext>;
/**
 * @summary Start an exam session (server-side timing)
 */
export declare const getStartExamSessionUrl: (id: number) => string;
export declare const startExamSession: (id: number, startExamBody: StartExamBody, options?: RequestInit) => Promise<ExamSessionResponse>;
export declare const getStartExamSessionMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof startExamSession>>, TError, {
        id: number;
        data: BodyType<StartExamBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof startExamSession>>, TError, {
    id: number;
    data: BodyType<StartExamBody>;
}, TContext>;
export type StartExamSessionMutationResult = NonNullable<Awaited<ReturnType<typeof startExamSession>>>;
export type StartExamSessionMutationBody = BodyType<StartExamBody>;
export type StartExamSessionMutationError = ErrorType<unknown>;
/**
 * @summary Start an exam session (server-side timing)
 */
export declare const useStartExamSession: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof startExamSession>>, TError, {
        id: number;
        data: BodyType<StartExamBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof startExamSession>>, TError, {
    id: number;
    data: BodyType<StartExamBody>;
}, TContext>;
/**
 * @summary Submit answers for an assignment
 */
export declare const getSubmitAssignmentUrl: (id: number) => string;
export declare const submitAssignment: (id: number, submitAssignmentBody: SubmitAssignmentBody, options?: RequestInit) => Promise<SubmissionResult>;
export declare const getSubmitAssignmentMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof submitAssignment>>, TError, {
        id: number;
        data: BodyType<SubmitAssignmentBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof submitAssignment>>, TError, {
    id: number;
    data: BodyType<SubmitAssignmentBody>;
}, TContext>;
export type SubmitAssignmentMutationResult = NonNullable<Awaited<ReturnType<typeof submitAssignment>>>;
export type SubmitAssignmentMutationBody = BodyType<SubmitAssignmentBody>;
export type SubmitAssignmentMutationError = ErrorType<unknown>;
/**
 * @summary Submit answers for an assignment
 */
export declare const useSubmitAssignment: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof submitAssignment>>, TError, {
        id: number;
        data: BodyType<SubmitAssignmentBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof submitAssignment>>, TError, {
    id: number;
    data: BodyType<SubmitAssignmentBody>;
}, TContext>;
/**
 * @summary Submit assignment via uploaded image
 */
export declare const getSubmitAssignmentImageUrl: (id: number) => string;
export declare const submitAssignmentImage: (id: number, submitImageBody: SubmitImageBody, options?: RequestInit) => Promise<SubmissionResult>;
export declare const getSubmitAssignmentImageMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof submitAssignmentImage>>, TError, {
        id: number;
        data: BodyType<SubmitImageBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof submitAssignmentImage>>, TError, {
    id: number;
    data: BodyType<SubmitImageBody>;
}, TContext>;
export type SubmitAssignmentImageMutationResult = NonNullable<Awaited<ReturnType<typeof submitAssignmentImage>>>;
export type SubmitAssignmentImageMutationBody = BodyType<SubmitImageBody>;
export type SubmitAssignmentImageMutationError = ErrorType<unknown>;
/**
 * @summary Submit assignment via uploaded image
 */
export declare const useSubmitAssignmentImage: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof submitAssignmentImage>>, TError, {
        id: number;
        data: BodyType<SubmitImageBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof submitAssignmentImage>>, TError, {
    id: number;
    data: BodyType<SubmitImageBody>;
}, TContext>;
/**
 * @summary List submissions for an assignment
 */
export declare const getListSubmissionsUrl: (id: number) => string;
export declare const listSubmissions: (id: number, options?: RequestInit) => Promise<Submission[]>;
export declare const getListSubmissionsQueryKey: (id: number) => readonly [`/api/assignments/${number}/submissions`];
export declare const getListSubmissionsQueryOptions: <TData = Awaited<ReturnType<typeof listSubmissions>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listSubmissions>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listSubmissions>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListSubmissionsQueryResult = NonNullable<Awaited<ReturnType<typeof listSubmissions>>>;
export type ListSubmissionsQueryError = ErrorType<unknown>;
/**
 * @summary List submissions for an assignment
 */
export declare function useListSubmissions<TData = Awaited<ReturnType<typeof listSubmissions>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listSubmissions>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Export submissions as CSV
 */
export declare const getExportSubmissionsCsvUrl: (id: number) => string;
export declare const exportSubmissionsCsv: (id: number, options?: RequestInit) => Promise<string>;
export declare const getExportSubmissionsCsvQueryKey: (id: number) => readonly [`/api/assignments/${number}/export-csv`];
export declare const getExportSubmissionsCsvQueryOptions: <TData = Awaited<ReturnType<typeof exportSubmissionsCsv>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof exportSubmissionsCsv>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof exportSubmissionsCsv>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ExportSubmissionsCsvQueryResult = NonNullable<Awaited<ReturnType<typeof exportSubmissionsCsv>>>;
export type ExportSubmissionsCsvQueryError = ErrorType<unknown>;
/**
 * @summary Export submissions as CSV
 */
export declare function useExportSubmissionsCsv<TData = Awaited<ReturnType<typeof exportSubmissionsCsv>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof exportSubmissionsCsv>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update submission grade (teacher only)
 */
export declare const getUpdateSubmissionUrl: (submissionId: number) => string;
export declare const updateSubmission: (submissionId: number, updateSubmissionBody: UpdateSubmissionBody, options?: RequestInit) => Promise<Submission>;
export declare const getUpdateSubmissionMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateSubmission>>, TError, {
        submissionId: number;
        data: BodyType<UpdateSubmissionBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateSubmission>>, TError, {
    submissionId: number;
    data: BodyType<UpdateSubmissionBody>;
}, TContext>;
export type UpdateSubmissionMutationResult = NonNullable<Awaited<ReturnType<typeof updateSubmission>>>;
export type UpdateSubmissionMutationBody = BodyType<UpdateSubmissionBody>;
export type UpdateSubmissionMutationError = ErrorType<unknown>;
/**
 * @summary Update submission grade (teacher only)
 */
export declare const useUpdateSubmission: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateSubmission>>, TError, {
        submissionId: number;
        data: BodyType<UpdateSubmissionBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateSubmission>>, TError, {
    submissionId: number;
    data: BodyType<UpdateSubmissionBody>;
}, TContext>;
/**
 * @summary Get full submission with per-answer details (teacher only)
 */
export declare const getGetSubmissionDetailsUrl: (submissionId: number) => string;
export declare const getSubmissionDetails: (submissionId: number, options?: RequestInit) => Promise<SubmissionDetail>;
export declare const getGetSubmissionDetailsQueryKey: (submissionId: number) => readonly [`/api/submissions/${number}/details`];
export declare const getGetSubmissionDetailsQueryOptions: <TData = Awaited<ReturnType<typeof getSubmissionDetails>>, TError = ErrorType<unknown>>(submissionId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getSubmissionDetails>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getSubmissionDetails>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetSubmissionDetailsQueryResult = NonNullable<Awaited<ReturnType<typeof getSubmissionDetails>>>;
export type GetSubmissionDetailsQueryError = ErrorType<unknown>;
/**
 * @summary Get full submission with per-answer details (teacher only)
 */
export declare function useGetSubmissionDetails<TData = Awaited<ReturnType<typeof getSubmissionDetails>>, TError = ErrorType<unknown>>(submissionId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getSubmissionDetails>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Manually grade a single answer (teacher only)
 */
export declare const getUpdateAnswerGradeUrl: (answerId: number) => string;
export declare const updateAnswerGrade: (answerId: number, updateAnswerBody: UpdateAnswerBody, options?: RequestInit) => Promise<SubmissionDetail>;
export declare const getUpdateAnswerGradeMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateAnswerGrade>>, TError, {
        answerId: number;
        data: BodyType<UpdateAnswerBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateAnswerGrade>>, TError, {
    answerId: number;
    data: BodyType<UpdateAnswerBody>;
}, TContext>;
export type UpdateAnswerGradeMutationResult = NonNullable<Awaited<ReturnType<typeof updateAnswerGrade>>>;
export type UpdateAnswerGradeMutationBody = BodyType<UpdateAnswerBody>;
export type UpdateAnswerGradeMutationError = ErrorType<unknown>;
/**
 * @summary Manually grade a single answer (teacher only)
 */
export declare const useUpdateAnswerGrade: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateAnswerGrade>>, TError, {
        answerId: number;
        data: BodyType<UpdateAnswerBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateAnswerGrade>>, TError, {
    answerId: number;
    data: BodyType<UpdateAnswerBody>;
}, TContext>;
/**
 * @summary Submit feedback or suggestion
 */
export declare const getSubmitFeedbackUrl: () => string;
export declare const submitFeedback: (submitFeedbackBody: SubmitFeedbackBody, options?: RequestInit) => Promise<SuccessResponse>;
export declare const getSubmitFeedbackMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof submitFeedback>>, TError, {
        data: BodyType<SubmitFeedbackBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof submitFeedback>>, TError, {
    data: BodyType<SubmitFeedbackBody>;
}, TContext>;
export type SubmitFeedbackMutationResult = NonNullable<Awaited<ReturnType<typeof submitFeedback>>>;
export type SubmitFeedbackMutationBody = BodyType<SubmitFeedbackBody>;
export type SubmitFeedbackMutationError = ErrorType<unknown>;
/**
 * @summary Submit feedback or suggestion
 */
export declare const useSubmitFeedback: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof submitFeedback>>, TError, {
        data: BodyType<SubmitFeedbackBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof submitFeedback>>, TError, {
    data: BodyType<SubmitFeedbackBody>;
}, TContext>;
/**
 * @summary Get the effective presentations tier and limits for the caller
 */
export declare const getGetPresentationsLimitsUrl: () => string;
export declare const getPresentationsLimits: (options?: RequestInit) => Promise<PresentationTier>;
export declare const getGetPresentationsLimitsQueryKey: () => readonly ["/api/presentations/limits"];
export declare const getGetPresentationsLimitsQueryOptions: <TData = Awaited<ReturnType<typeof getPresentationsLimits>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPresentationsLimits>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPresentationsLimits>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPresentationsLimitsQueryResult = NonNullable<Awaited<ReturnType<typeof getPresentationsLimits>>>;
export type GetPresentationsLimitsQueryError = ErrorType<unknown>;
/**
 * @summary Get the effective presentations tier and limits for the caller
 */
export declare function useGetPresentationsLimits<TData = Awaited<ReturnType<typeof getPresentationsLimits>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPresentationsLimits>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get tier limits + per-deck usage for a single presentation
 */
export declare const getGetPresentationUsageUrl: (id: number) => string;
export declare const getPresentationUsage: (id: number, options?: RequestInit) => Promise<PresentationTierWithUsage>;
export declare const getGetPresentationUsageQueryKey: (id: number) => readonly [`/api/presentations/${number}/usage`];
export declare const getGetPresentationUsageQueryOptions: <TData = Awaited<ReturnType<typeof getPresentationUsage>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPresentationUsage>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPresentationUsage>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPresentationUsageQueryResult = NonNullable<Awaited<ReturnType<typeof getPresentationUsage>>>;
export type GetPresentationUsageQueryError = ErrorType<unknown>;
/**
 * @summary Get tier limits + per-deck usage for a single presentation
 */
export declare function useGetPresentationUsage<TData = Awaited<ReturnType<typeof getPresentationUsage>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPresentationUsage>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary List own presentations + admin-shared
 */
export declare const getListPresentationsUrl: () => string;
export declare const listPresentations: (options?: RequestInit) => Promise<PresentationSummary[]>;
export declare const getListPresentationsQueryKey: () => readonly ["/api/presentations"];
export declare const getListPresentationsQueryOptions: <TData = Awaited<ReturnType<typeof listPresentations>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPresentations>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listPresentations>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListPresentationsQueryResult = NonNullable<Awaited<ReturnType<typeof listPresentations>>>;
export type ListPresentationsQueryError = ErrorType<void>;
/**
 * @summary List own presentations + admin-shared
 */
export declare function useListPresentations<TData = Awaited<ReturnType<typeof listPresentations>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPresentations>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a new presentation
 */
export declare const getCreatePresentationUrl: () => string;
export declare const createPresentation: (createPresentationBody: CreatePresentationBody, options?: RequestInit) => Promise<Presentation>;
export declare const getCreatePresentationMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPresentation>>, TError, {
        data: BodyType<CreatePresentationBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createPresentation>>, TError, {
    data: BodyType<CreatePresentationBody>;
}, TContext>;
export type CreatePresentationMutationResult = NonNullable<Awaited<ReturnType<typeof createPresentation>>>;
export type CreatePresentationMutationBody = BodyType<CreatePresentationBody>;
export type CreatePresentationMutationError = ErrorType<unknown>;
/**
 * @summary Create a new presentation
 */
export declare const useCreatePresentation: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPresentation>>, TError, {
        data: BodyType<CreatePresentationBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createPresentation>>, TError, {
    data: BodyType<CreatePresentationBody>;
}, TContext>;
/**
 * @summary Get a presentation (owner or admin-shared)
 */
export declare const getGetPresentationUrl: (id: number) => string;
export declare const getPresentation: (id: number, options?: RequestInit) => Promise<Presentation>;
export declare const getGetPresentationQueryKey: (id: number) => readonly [`/api/presentations/${number}`];
export declare const getGetPresentationQueryOptions: <TData = Awaited<ReturnType<typeof getPresentation>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPresentation>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPresentation>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPresentationQueryResult = NonNullable<Awaited<ReturnType<typeof getPresentation>>>;
export type GetPresentationQueryError = ErrorType<void>;
/**
 * @summary Get a presentation (owner or admin-shared)
 */
export declare function useGetPresentation<TData = Awaited<ReturnType<typeof getPresentation>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPresentation>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update a presentation (owner only)
 */
export declare const getUpdatePresentationUrl: (id: number) => string;
export declare const updatePresentation: (id: number, updatePresentationBody: UpdatePresentationBody, options?: RequestInit) => Promise<Presentation>;
export declare const getUpdatePresentationMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePresentation>>, TError, {
        id: number;
        data: BodyType<UpdatePresentationBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updatePresentation>>, TError, {
    id: number;
    data: BodyType<UpdatePresentationBody>;
}, TContext>;
export type UpdatePresentationMutationResult = NonNullable<Awaited<ReturnType<typeof updatePresentation>>>;
export type UpdatePresentationMutationBody = BodyType<UpdatePresentationBody>;
export type UpdatePresentationMutationError = ErrorType<unknown>;
/**
 * @summary Update a presentation (owner only)
 */
export declare const useUpdatePresentation: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePresentation>>, TError, {
        id: number;
        data: BodyType<UpdatePresentationBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updatePresentation>>, TError, {
    id: number;
    data: BodyType<UpdatePresentationBody>;
}, TContext>;
/**
 * @summary Delete a presentation (owner only)
 */
export declare const getDeletePresentationUrl: (id: number) => string;
export declare const deletePresentation: (id: number, options?: RequestInit) => Promise<SuccessResponse>;
export declare const getDeletePresentationMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePresentation>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deletePresentation>>, TError, {
    id: number;
}, TContext>;
export type DeletePresentationMutationResult = NonNullable<Awaited<ReturnType<typeof deletePresentation>>>;
export type DeletePresentationMutationError = ErrorType<unknown>;
/**
 * @summary Delete a presentation (owner only)
 */
export declare const useDeletePresentation: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePresentation>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deletePresentation>>, TError, {
    id: number;
}, TContext>;
/**
 * @summary Publish a presentation (owner only)
 */
export declare const getPublishPresentationUrl: (id: number) => string;
export declare const publishPresentation: (id: number, options?: RequestInit) => Promise<Presentation>;
export declare const getPublishPresentationMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof publishPresentation>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof publishPresentation>>, TError, {
    id: number;
}, TContext>;
export type PublishPresentationMutationResult = NonNullable<Awaited<ReturnType<typeof publishPresentation>>>;
export type PublishPresentationMutationError = ErrorType<unknown>;
/**
 * @summary Publish a presentation (owner only)
 */
export declare const usePublishPresentation: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof publishPresentation>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof publishPresentation>>, TError, {
    id: number;
}, TContext>;
/**
 * @summary Move a presentation back to draft (owner only)
 */
export declare const getUnpublishPresentationUrl: (id: number) => string;
export declare const unpublishPresentation: (id: number, options?: RequestInit) => Promise<Presentation>;
export declare const getUnpublishPresentationMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof unpublishPresentation>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof unpublishPresentation>>, TError, {
    id: number;
}, TContext>;
export type UnpublishPresentationMutationResult = NonNullable<Awaited<ReturnType<typeof unpublishPresentation>>>;
export type UnpublishPresentationMutationError = ErrorType<unknown>;
/**
 * @summary Move a presentation back to draft (owner only)
 */
export declare const useUnpublishPresentation: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof unpublishPresentation>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof unpublishPresentation>>, TError, {
    id: number;
}, TContext>;
/**
 * @summary Link or unlink the presentation to a teacher activity (assignment)
 */
export declare const getLinkPresentationActivityUrl: (id: number) => string;
export declare const linkPresentationActivity: (id: number, linkPresentationActivityBody: LinkPresentationActivityBody, options?: RequestInit) => Promise<LinkPresentationActivity200>;
export declare const getLinkPresentationActivityMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof linkPresentationActivity>>, TError, {
        id: number;
        data: BodyType<LinkPresentationActivityBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof linkPresentationActivity>>, TError, {
    id: number;
    data: BodyType<LinkPresentationActivityBody>;
}, TContext>;
export type LinkPresentationActivityMutationResult = NonNullable<Awaited<ReturnType<typeof linkPresentationActivity>>>;
export type LinkPresentationActivityMutationBody = BodyType<LinkPresentationActivityBody>;
export type LinkPresentationActivityMutationError = ErrorType<unknown>;
/**
 * @summary Link or unlink the presentation to a teacher activity (assignment)
 */
export declare const useLinkPresentationActivity: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof linkPresentationActivity>>, TError, {
        id: number;
        data: BodyType<LinkPresentationActivityBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof linkPresentationActivity>>, TError, {
    id: number;
    data: BodyType<LinkPresentationActivityBody>;
}, TContext>;
/**
 * @summary Resolve the linked activity (or null if none / dangling)
 */
export declare const getGetPresentationLinkedActivityUrl: (id: number) => string;
export declare const getPresentationLinkedActivity: (id: number, options?: RequestInit) => Promise<GetPresentationLinkedActivity200>;
export declare const getGetPresentationLinkedActivityQueryKey: (id: number) => readonly [`/api/presentations/${number}/linked-activity`];
export declare const getGetPresentationLinkedActivityQueryOptions: <TData = Awaited<ReturnType<typeof getPresentationLinkedActivity>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPresentationLinkedActivity>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPresentationLinkedActivity>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPresentationLinkedActivityQueryResult = NonNullable<Awaited<ReturnType<typeof getPresentationLinkedActivity>>>;
export type GetPresentationLinkedActivityQueryError = ErrorType<unknown>;
/**
 * @summary Resolve the linked activity (or null if none / dangling)
 */
export declare function useGetPresentationLinkedActivity<TData = Awaited<ReturnType<typeof getPresentationLinkedActivity>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPresentationLinkedActivity>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Duplicate a presentation (owner or admin-shared)
 */
export declare const getDuplicatePresentationUrl: (id: number) => string;
export declare const duplicatePresentation: (id: number, options?: RequestInit) => Promise<Presentation>;
export declare const getDuplicatePresentationMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof duplicatePresentation>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof duplicatePresentation>>, TError, {
    id: number;
}, TContext>;
export type DuplicatePresentationMutationResult = NonNullable<Awaited<ReturnType<typeof duplicatePresentation>>>;
export type DuplicatePresentationMutationError = ErrorType<unknown>;
/**
 * @summary Duplicate a presentation (owner or admin-shared)
 */
export declare const useDuplicatePresentation: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof duplicatePresentation>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof duplicatePresentation>>, TError, {
    id: number;
}, TContext>;
/**
 * @summary List uploaded assets for a presentation
 */
export declare const getListPresentationAssetsUrl: (id: number) => string;
export declare const listPresentationAssets: (id: number, options?: RequestInit) => Promise<PresentationAsset[]>;
export declare const getListPresentationAssetsQueryKey: (id: number) => readonly [`/api/presentations/${number}/assets`];
export declare const getListPresentationAssetsQueryOptions: <TData = Awaited<ReturnType<typeof listPresentationAssets>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPresentationAssets>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listPresentationAssets>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListPresentationAssetsQueryResult = NonNullable<Awaited<ReturnType<typeof listPresentationAssets>>>;
export type ListPresentationAssetsQueryError = ErrorType<unknown>;
/**
 * @summary List uploaded assets for a presentation
 */
export declare function useListPresentationAssets<TData = Awaited<ReturnType<typeof listPresentationAssets>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPresentationAssets>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Register an uploaded asset URL on a presentation
 */
export declare const getRegisterPresentationAssetUrl: (id: number) => string;
export declare const registerPresentationAsset: (id: number, registerAssetBody: RegisterAssetBody, options?: RequestInit) => Promise<PresentationAsset>;
export declare const getRegisterPresentationAssetMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof registerPresentationAsset>>, TError, {
        id: number;
        data: BodyType<RegisterAssetBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof registerPresentationAsset>>, TError, {
    id: number;
    data: BodyType<RegisterAssetBody>;
}, TContext>;
export type RegisterPresentationAssetMutationResult = NonNullable<Awaited<ReturnType<typeof registerPresentationAsset>>>;
export type RegisterPresentationAssetMutationBody = BodyType<RegisterAssetBody>;
export type RegisterPresentationAssetMutationError = ErrorType<unknown>;
/**
 * @summary Register an uploaded asset URL on a presentation
 */
export declare const useRegisterPresentationAsset: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof registerPresentationAsset>>, TError, {
        id: number;
        data: BodyType<RegisterAssetBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof registerPresentationAsset>>, TError, {
    id: number;
    data: BodyType<RegisterAssetBody>;
}, TContext>;
/**
 * @summary Tier-driven limits for AI outline generation
 */
export declare const getGetPresentationAiLimitsUrl: () => string;
export declare const getPresentationAiLimits: (options?: RequestInit) => Promise<PresentationAiLimits>;
export declare const getGetPresentationAiLimitsQueryKey: () => readonly ["/api/presentations/ai/limits"];
export declare const getGetPresentationAiLimitsQueryOptions: <TData = Awaited<ReturnType<typeof getPresentationAiLimits>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPresentationAiLimits>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPresentationAiLimits>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPresentationAiLimitsQueryResult = NonNullable<Awaited<ReturnType<typeof getPresentationAiLimits>>>;
export type GetPresentationAiLimitsQueryError = ErrorType<unknown>;
/**
 * @summary Tier-driven limits for AI outline generation
 */
export declare function useGetPresentationAiLimits<TData = Awaited<ReturnType<typeof getPresentationAiLimits>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPresentationAiLimits>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Generate a reviewable outline (Phase 1A) — does NOT build slides
 */
export declare const getGeneratePresentationOutlineUrl: () => string;
export declare const generatePresentationOutline: (presentationBrief: PresentationBrief, options?: RequestInit) => Promise<PresentationDraftWithGuardrails>;
export declare const getGeneratePresentationOutlineMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generatePresentationOutline>>, TError, {
        data: BodyType<PresentationBrief>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof generatePresentationOutline>>, TError, {
    data: BodyType<PresentationBrief>;
}, TContext>;
export type GeneratePresentationOutlineMutationResult = NonNullable<Awaited<ReturnType<typeof generatePresentationOutline>>>;
export type GeneratePresentationOutlineMutationBody = BodyType<PresentationBrief>;
export type GeneratePresentationOutlineMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Generate a reviewable outline (Phase 1A) — does NOT build slides
 */
export declare const useGeneratePresentationOutline: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generatePresentationOutline>>, TError, {
        data: BodyType<PresentationBrief>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof generatePresentationOutline>>, TError, {
    data: BodyType<PresentationBrief>;
}, TContext>;
/**
 * Per-slide materialization with skip-on-failure semantics. Failed
slides are reported in `skipped` so the teacher can author them
manually. Progress is persisted on the draft row after every
slide so a parallel poll on `GET /presentations/drafts/{id}`
can drive a real progress bar without SSE plumbing.

 * @summary Phase 1B — materialize an approved outline into a real deck
 */
export declare const getBuildPresentationFromDraftUrl: (draftId: number) => string;
export declare const buildPresentationFromDraft: (draftId: number, buildPresentationRequest?: BuildPresentationRequest, options?: RequestInit) => Promise<BuildPresentationResponse>;
export declare const getBuildPresentationFromDraftMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof buildPresentationFromDraft>>, TError, {
        draftId: number;
        data: BodyType<BuildPresentationRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof buildPresentationFromDraft>>, TError, {
    draftId: number;
    data: BodyType<BuildPresentationRequest>;
}, TContext>;
export type BuildPresentationFromDraftMutationResult = NonNullable<Awaited<ReturnType<typeof buildPresentationFromDraft>>>;
export type BuildPresentationFromDraftMutationBody = BodyType<BuildPresentationRequest>;
export type BuildPresentationFromDraftMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Phase 1B — materialize an approved outline into a real deck
 */
export declare const useBuildPresentationFromDraft: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof buildPresentationFromDraft>>, TError, {
        draftId: number;
        data: BodyType<BuildPresentationRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof buildPresentationFromDraft>>, TError, {
    draftId: number;
    data: BodyType<BuildPresentationRequest>;
}, TContext>;
/**
 * Server-Sent Events feed: emits `progress` events on each
polling tick and a terminal `done` event when the build
finishes (status `built` or `failed`). Consumed via the
browser's `EventSource`. Polling on the draft row remains
available as a fallback driver.

 * @summary Phase 1B — SSE stream of build progress
 */
export declare const getStreamPresentationBuildUrl: (draftId: number) => string;
export declare const streamPresentationBuild: (draftId: number, options?: RequestInit) => Promise<string>;
export declare const getStreamPresentationBuildQueryKey: (draftId: number) => readonly [`/api/presentations/ai/build/${number}/stream`];
export declare const getStreamPresentationBuildQueryOptions: <TData = Awaited<ReturnType<typeof streamPresentationBuild>>, TError = ErrorType<ErrorResponse>>(draftId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof streamPresentationBuild>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof streamPresentationBuild>>, TError, TData> & {
    queryKey: QueryKey;
};
export type StreamPresentationBuildQueryResult = NonNullable<Awaited<ReturnType<typeof streamPresentationBuild>>>;
export type StreamPresentationBuildQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Phase 1B — SSE stream of build progress
 */
export declare function useStreamPresentationBuild<TData = Awaited<ReturnType<typeof streamPresentationBuild>>, TError = ErrorType<ErrorResponse>>(draftId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof streamPresentationBuild>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * Sets an in-memory cancel flag the build loop checks once per
slide. Idempotent. Slides validated before the cancel arrived
are still persisted into the resulting deck.

 * @summary Phase 1B — request cancellation of an in-flight build
 */
export declare const getCancelPresentationBuildUrl: (draftId: number) => string;
export declare const cancelPresentationBuild: (draftId: number, options?: RequestInit) => Promise<CancelBuildResponse>;
export declare const getCancelPresentationBuildMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof cancelPresentationBuild>>, TError, {
        draftId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof cancelPresentationBuild>>, TError, {
    draftId: number;
}, TContext>;
export type CancelPresentationBuildMutationResult = NonNullable<Awaited<ReturnType<typeof cancelPresentationBuild>>>;
export type CancelPresentationBuildMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Phase 1B — request cancellation of an in-flight build
 */
export declare const useCancelPresentationBuild: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof cancelPresentationBuild>>, TError, {
        draftId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof cancelPresentationBuild>>, TError, {
    draftId: number;
}, TContext>;
/**
 * @summary List the current teacher's saved outline drafts
 */
export declare const getListPresentationDraftsUrl: () => string;
export declare const listPresentationDrafts: (options?: RequestInit) => Promise<PresentationDraft[]>;
export declare const getListPresentationDraftsQueryKey: () => readonly ["/api/presentations/drafts"];
export declare const getListPresentationDraftsQueryOptions: <TData = Awaited<ReturnType<typeof listPresentationDrafts>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPresentationDrafts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listPresentationDrafts>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListPresentationDraftsQueryResult = NonNullable<Awaited<ReturnType<typeof listPresentationDrafts>>>;
export type ListPresentationDraftsQueryError = ErrorType<unknown>;
/**
 * @summary List the current teacher's saved outline drafts
 */
export declare function useListPresentationDrafts<TData = Awaited<ReturnType<typeof listPresentationDrafts>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPresentationDrafts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Read one draft (owner only)
 */
export declare const getGetPresentationDraftUrl: (id: number) => string;
export declare const getPresentationDraft: (id: number, options?: RequestInit) => Promise<PresentationDraft>;
export declare const getGetPresentationDraftQueryKey: (id: number) => readonly [`/api/presentations/drafts/${number}`];
export declare const getGetPresentationDraftQueryOptions: <TData = Awaited<ReturnType<typeof getPresentationDraft>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPresentationDraft>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPresentationDraft>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPresentationDraftQueryResult = NonNullable<Awaited<ReturnType<typeof getPresentationDraft>>>;
export type GetPresentationDraftQueryError = ErrorType<unknown>;
/**
 * @summary Read one draft (owner only)
 */
export declare function useGetPresentationDraft<TData = Awaited<ReturnType<typeof getPresentationDraft>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPresentationDraft>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update outline or status (owner only)
 */
export declare const getUpdatePresentationDraftUrl: (id: number) => string;
export declare const updatePresentationDraft: (id: number, updatePresentationDraftBody: UpdatePresentationDraftBody, options?: RequestInit) => Promise<PresentationDraft>;
export declare const getUpdatePresentationDraftMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePresentationDraft>>, TError, {
        id: number;
        data: BodyType<UpdatePresentationDraftBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updatePresentationDraft>>, TError, {
    id: number;
    data: BodyType<UpdatePresentationDraftBody>;
}, TContext>;
export type UpdatePresentationDraftMutationResult = NonNullable<Awaited<ReturnType<typeof updatePresentationDraft>>>;
export type UpdatePresentationDraftMutationBody = BodyType<UpdatePresentationDraftBody>;
export type UpdatePresentationDraftMutationError = ErrorType<unknown>;
/**
 * @summary Update outline or status (owner only)
 */
export declare const useUpdatePresentationDraft: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePresentationDraft>>, TError, {
        id: number;
        data: BodyType<UpdatePresentationDraftBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updatePresentationDraft>>, TError, {
    id: number;
    data: BodyType<UpdatePresentationDraftBody>;
}, TContext>;
/**
 * @summary Delete a draft (owner only)
 */
export declare const getDeletePresentationDraftUrl: (id: number) => string;
export declare const deletePresentationDraft: (id: number, options?: RequestInit) => Promise<void>;
export declare const getDeletePresentationDraftMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePresentationDraft>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deletePresentationDraft>>, TError, {
    id: number;
}, TContext>;
export type DeletePresentationDraftMutationResult = NonNullable<Awaited<ReturnType<typeof deletePresentationDraft>>>;
export type DeletePresentationDraftMutationError = ErrorType<unknown>;
/**
 * @summary Delete a draft (owner only)
 */
export declare const useDeletePresentationDraft: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePresentationDraft>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deletePresentationDraft>>, TError, {
    id: number;
}, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map