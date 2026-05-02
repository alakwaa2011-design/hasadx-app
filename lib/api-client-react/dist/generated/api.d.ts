import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import type { AdminTeacherSummary, Assignment, AssignmentWithQuestions, AuthResponse, CreateAssignmentBody, ErrorResponse, ExamSessionResponse, HealthStatus, ListAssignmentsParams, LoginTeacherBody, RegisterTeacherBody, RevokeSessionResponse, RevokeSessionsResponse, StartExamBody, Submission, SubmissionResult, SubmitAssignmentBody, SubmitFeedbackBody, SubmitImageBody, SuccessResponse, TeacherProfile, TeacherSession, UpdateProfileBody, UpdateSubmissionBody } from "./api.schemas";
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
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>>;
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
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>>;
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
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getCurrentTeacher>>, TError, TData>>;
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
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getCurrentTeacher>>, TError, TData>>;
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
 * @summary List active sessions for the current teacher
 */
export declare const getListTeacherSessionsUrl: () => string;
export declare const listTeacherSessions: (options?: RequestInit) => Promise<TeacherSession[]>;
export declare const getListTeacherSessionsQueryKey: () => readonly ["/api/auth/sessions"];
export declare const getListTeacherSessionsQueryOptions: <TData = Awaited<ReturnType<typeof listTeacherSessions>>, TError = ErrorType<void>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listTeacherSessions>>, TError, TData>>;
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
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listTeacherSessions>>, TError, TData>>;
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
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listAllTeachers>>, TError, TData>>;
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
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listAllTeachers>>, TError, TData>>;
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
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listAssignments>>, TError, TData>>;
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
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listAssignments>>, TError, TData>>;
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
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getAssignment>>, TError, TData>>;
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
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getAssignment>>, TError, TData>>;
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
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listSubmissions>>, TError, TData>>;
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
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listSubmissions>>, TError, TData>>;
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
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof exportSubmissionsCsv>>, TError, TData>>;
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
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof exportSubmissionsCsv>>, TError, TData>>;
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
export {};
//# sourceMappingURL=api.d.ts.map