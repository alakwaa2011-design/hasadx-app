import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { AdminDirectoryPage, AdminHideAssignmentBody, AdminHideQuestionBankItemBody, AdminHideVideoLessonBody, AdminTeacherSummary, AiVideoBrief, AiVideoProject, AiVideoRenderBody, AiVideoRenderQuote, Assignment, AssignmentWithQuestions, AssistantAvailability, AssistantConfirmation, AssistantExecutionEventInput, AssistantExecutionEventReceipt, AssistantExecutionMetrics, AssistantHistory, AssistantOperation, AssistantPreparation, AssistantWorksheetRequest, AuthResponse, BriefPreferences, BuildPresentationRequest, BuildPresentationResponse, CancelBuildResponse, CreateAssignmentBody, CreatePresentationBody, DeletedSubmissionsResult, ErrorResponse, ExamSessionResponse, GameShareLink, GameShareLinkInput, GetPresentationLinkedActivity200, GetQuranAyahEducationParams, GetQuranOfflineContent200, GetQuranOfflineContentParams, GoogleLoginBody, HealthStatus, LinkPresentationActivity200, LinkPresentationActivityBody, ListAdminDirectoryParams, ListAiVideoProjects200, ListAssignmentsParams, ListTeacherQuranMemorizationItemsParams, LoginTeacherBody, Presentation, PresentationAiLimits, PresentationAsset, PresentationBrief, PresentationDraft, PresentationDraftWithGuardrails, PresentationOutlineJob, PresentationSummary, PresentationTier, PresentationTierWithUsage, QuranAudioPreference, QuranAudioPreferenceInput, QuranAyahEducation, QuranAyahTimings, QuranBookmark, QuranBookmarkInput, QuranCircle, QuranCircleInput, QuranCircleTaskInput, QuranCircleUpdate, QuranIndependentPosition, QuranIndependentPositionInput, QuranIndependentSession, QuranIndependentSessionInput, QuranJourney, QuranMadaniPage, QuranMemorizationAssessment, QuranMemorizationItem, QuranMemorizationSummary, QuranProfileUpdate, QuranReaderPosition, QuranReaderPositionConflict, QuranReaderState, QuranRecitation, QuranRecitationInput, QuranRecitationPartialResponse, QuranReciterCatalog, QuranReviewWard, QuranStudent, QuranStudentProfile, QuranStudentSummary, QuranSubmission, QuranSubmissionAudioUrl, QuranSubmissionFinalizeInput, QuranSubmissionReviewInput, QuranSubmissionReviewItem, QuranSubmissionUploadInput, QuranSubmissionUploadResponse, QuranSurah, QuranSurahContent, QuranTodayDashboard, QuranWard, QuranWardInput, QuranWardUpdate, QuranWordTajweed, RegisterAssetBody, RegisterTeacherBody, RevokeSessionResponse, RevokeSessionsResponse, StartExamBody, Submission, SubmissionDetail, SubmissionResult, SubmitAssignmentBody, SubmitFeedbackBody, SubmitImageBody, SuccessResponse, TeacherProfile, TeacherQuranMemorizationHistoryEvent, TeacherQuranMemorizationItems, TeacherQuranMemorizationStudent, TeacherQuranMemorizationSummary, TeacherScheduleBulkInput, TeacherScheduleDeleteResult, TeacherScheduleEntry, TeacherScheduleEntryInput, TeacherScheduleEntryUpdate, TeacherSession, TranscribeQuranRecitationPartialBody, TutorialLinks, UpdateAiVideoProjectBody, UpdateAnswerBody, UpdateAssignmentLifecycleBody, UpdateAssignmentLifecycleResponse, UpdatePresentationBody, UpdatePresentationDraftBody, UpdateProfileBody, UpdateQuranReaderPosition, UpdateRoleBody, UpdateSubmissionBody, UploadAiVideoSourceImage201, UploadAiVideoSourceImageBody, WorksheetActivityInput, WorksheetActivityResult, WorksheetActivitySourceInput, WorksheetPageRenderInput } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getGetAssistantExecutionMetricsUrl: () => string;
export declare const getAssistantExecutionMetrics: (options?: Parameters<typeof customFetch>[1]) => Promise<AssistantExecutionMetrics>;
export declare const getGetAssistantExecutionMetricsQueryKey: () => readonly ["/api/assistant/admin/execution-metrics"];
export declare const getGetAssistantExecutionMetricsQueryOptions: <TData = Awaited<ReturnType<typeof getAssistantExecutionMetrics>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAssistantExecutionMetrics>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAssistantExecutionMetrics>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAssistantExecutionMetricsQueryResult = NonNullable<Awaited<ReturnType<typeof getAssistantExecutionMetrics>>>;
export type GetAssistantExecutionMetricsQueryError = ErrorType<unknown>;
export declare function useGetAssistantExecutionMetrics<TData = Awaited<ReturnType<typeof getAssistantExecutionMetrics>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAssistantExecutionMetrics>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getTrackAssistantExecutionEventUrl: () => string;
export declare const trackAssistantExecutionEvent: (assistantExecutionEventInput: AssistantExecutionEventInput, options?: Parameters<typeof customFetch>[1]) => Promise<AssistantExecutionEventReceipt>;
export declare const getTrackAssistantExecutionEventMutationKey: () => readonly ["trackAssistantExecutionEvent"];
export declare const getTrackAssistantExecutionEventMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof trackAssistantExecutionEvent>>, TError, TrackAssistantExecutionEventMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof trackAssistantExecutionEvent>>, TError, TrackAssistantExecutionEventMutationVariables, TContext>;
export type TrackAssistantExecutionEventMutationResult = NonNullable<Awaited<ReturnType<typeof trackAssistantExecutionEvent>>>;
export type TrackAssistantExecutionEventMutationBody = BodyType<AssistantExecutionEventInput>;
export type TrackAssistantExecutionEventMutationError = ErrorType<unknown>;
export type TrackAssistantExecutionEventMutationVariables = {
    data: BodyType<AssistantExecutionEventInput>;
};
export declare const useTrackAssistantExecutionEvent: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof trackAssistantExecutionEvent>>, TError, TrackAssistantExecutionEventMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof trackAssistantExecutionEvent>>, TError, TrackAssistantExecutionEventMutationVariables, TContext>;
export declare const getListAssistantOperationsUrl: () => string;
export declare const listAssistantOperations: (options?: Parameters<typeof customFetch>[1]) => Promise<AssistantHistory>;
export declare const getListAssistantOperationsQueryKey: () => readonly ["/api/assistant/operations"];
export declare const getListAssistantOperationsQueryOptions: <TData = Awaited<ReturnType<typeof listAssistantOperations>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAssistantOperations>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listAssistantOperations>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListAssistantOperationsQueryResult = NonNullable<Awaited<ReturnType<typeof listAssistantOperations>>>;
export type ListAssistantOperationsQueryError = ErrorType<unknown>;
export declare function useListAssistantOperations<TData = Awaited<ReturnType<typeof listAssistantOperations>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAssistantOperations>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getPrepareAssistantWorksheetUrl: () => string;
export declare const prepareAssistantWorksheet: (assistantPreparation: AssistantPreparation, options?: Parameters<typeof customFetch>[1]) => Promise<AssistantOperation>;
export declare const getPrepareAssistantWorksheetMutationKey: () => readonly ["prepareAssistantWorksheet"];
export declare const getPrepareAssistantWorksheetMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof prepareAssistantWorksheet>>, TError, PrepareAssistantWorksheetMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof prepareAssistantWorksheet>>, TError, PrepareAssistantWorksheetMutationVariables, TContext>;
export type PrepareAssistantWorksheetMutationResult = NonNullable<Awaited<ReturnType<typeof prepareAssistantWorksheet>>>;
export type PrepareAssistantWorksheetMutationBody = BodyType<AssistantPreparation>;
export type PrepareAssistantWorksheetMutationError = ErrorType<unknown>;
export type PrepareAssistantWorksheetMutationVariables = {
    data: BodyType<AssistantPreparation>;
};
export declare const usePrepareAssistantWorksheet: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof prepareAssistantWorksheet>>, TError, PrepareAssistantWorksheetMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof prepareAssistantWorksheet>>, TError, PrepareAssistantWorksheetMutationVariables, TContext>;
export declare const getGetAssistantOperationUrl: (id: string) => string;
export declare const getAssistantOperation: (id: string, options?: Parameters<typeof customFetch>[1]) => Promise<AssistantOperation>;
export declare const getGetAssistantOperationQueryKey: (id: string) => readonly [`/api/assistant/operations/${string}`];
export declare const getGetAssistantOperationQueryOptions: <TData = Awaited<ReturnType<typeof getAssistantOperation>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAssistantOperation>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAssistantOperation>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAssistantOperationQueryResult = NonNullable<Awaited<ReturnType<typeof getAssistantOperation>>>;
export type GetAssistantOperationQueryError = ErrorType<unknown>;
export declare function useGetAssistantOperation<TData = Awaited<ReturnType<typeof getAssistantOperation>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAssistantOperation>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getHideAssistantOperationUrl: (id: string) => string;
export declare const hideAssistantOperation: (id: string, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getHideAssistantOperationMutationKey: () => readonly ["hideAssistantOperation"];
export declare const getHideAssistantOperationMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof hideAssistantOperation>>, TError, HideAssistantOperationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof hideAssistantOperation>>, TError, HideAssistantOperationMutationVariables, TContext>;
export type HideAssistantOperationMutationResult = NonNullable<Awaited<ReturnType<typeof hideAssistantOperation>>>;
export type HideAssistantOperationMutationError = ErrorType<unknown>;
export type HideAssistantOperationMutationVariables = {
    id: string;
};
export declare const useHideAssistantOperation: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof hideAssistantOperation>>, TError, HideAssistantOperationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof hideAssistantOperation>>, TError, HideAssistantOperationMutationVariables, TContext>;
export declare const getQuoteAssistantWorksheetUrl: (id: string) => string;
export declare const quoteAssistantWorksheet: (id: string, assistantWorksheetRequest: AssistantWorksheetRequest, options?: Parameters<typeof customFetch>[1]) => Promise<AssistantOperation>;
export declare const getQuoteAssistantWorksheetMutationKey: () => readonly ["quoteAssistantWorksheet"];
export declare const getQuoteAssistantWorksheetMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof quoteAssistantWorksheet>>, TError, QuoteAssistantWorksheetMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof quoteAssistantWorksheet>>, TError, QuoteAssistantWorksheetMutationVariables, TContext>;
export type QuoteAssistantWorksheetMutationResult = NonNullable<Awaited<ReturnType<typeof quoteAssistantWorksheet>>>;
export type QuoteAssistantWorksheetMutationBody = BodyType<AssistantWorksheetRequest>;
export type QuoteAssistantWorksheetMutationError = ErrorType<unknown>;
export type QuoteAssistantWorksheetMutationVariables = {
    id: string;
    data: BodyType<AssistantWorksheetRequest>;
};
export declare const useQuoteAssistantWorksheet: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof quoteAssistantWorksheet>>, TError, QuoteAssistantWorksheetMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof quoteAssistantWorksheet>>, TError, QuoteAssistantWorksheetMutationVariables, TContext>;
export declare const getConfirmAssistantWorksheetUrl: (id: string) => string;
export declare const confirmAssistantWorksheet: (id: string, assistantConfirmation: AssistantConfirmation, options?: Parameters<typeof customFetch>[1]) => Promise<AssistantOperation>;
export declare const getConfirmAssistantWorksheetMutationKey: () => readonly ["confirmAssistantWorksheet"];
export declare const getConfirmAssistantWorksheetMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof confirmAssistantWorksheet>>, TError, ConfirmAssistantWorksheetMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof confirmAssistantWorksheet>>, TError, ConfirmAssistantWorksheetMutationVariables, TContext>;
export type ConfirmAssistantWorksheetMutationResult = NonNullable<Awaited<ReturnType<typeof confirmAssistantWorksheet>>>;
export type ConfirmAssistantWorksheetMutationBody = BodyType<AssistantConfirmation>;
export type ConfirmAssistantWorksheetMutationError = ErrorType<void>;
export type ConfirmAssistantWorksheetMutationVariables = {
    id: string;
    data: BodyType<AssistantConfirmation>;
};
export declare const useConfirmAssistantWorksheet: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof confirmAssistantWorksheet>>, TError, ConfirmAssistantWorksheetMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof confirmAssistantWorksheet>>, TError, ConfirmAssistantWorksheetMutationVariables, TContext>;
export declare const getCancelAssistantWorksheetUrl: (id: string) => string;
export declare const cancelAssistantWorksheet: (id: string, options?: Parameters<typeof customFetch>[1]) => Promise<AssistantOperation>;
export declare const getCancelAssistantWorksheetMutationKey: () => readonly ["cancelAssistantWorksheet"];
export declare const getCancelAssistantWorksheetMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof cancelAssistantWorksheet>>, TError, CancelAssistantWorksheetMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof cancelAssistantWorksheet>>, TError, CancelAssistantWorksheetMutationVariables, TContext>;
export type CancelAssistantWorksheetMutationResult = NonNullable<Awaited<ReturnType<typeof cancelAssistantWorksheet>>>;
export type CancelAssistantWorksheetMutationError = ErrorType<unknown>;
export type CancelAssistantWorksheetMutationVariables = {
    id: string;
};
export declare const useCancelAssistantWorksheet: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof cancelAssistantWorksheet>>, TError, CancelAssistantWorksheetMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof cancelAssistantWorksheet>>, TError, CancelAssistantWorksheetMutationVariables, TContext>;
export declare const getListAdminAssistantOperationsUrl: () => string;
export declare const listAdminAssistantOperations: (options?: Parameters<typeof customFetch>[1]) => Promise<AssistantHistory>;
export declare const getListAdminAssistantOperationsQueryKey: () => readonly ["/api/assistant/admin/operations"];
export declare const getListAdminAssistantOperationsQueryOptions: <TData = Awaited<ReturnType<typeof listAdminAssistantOperations>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAdminAssistantOperations>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listAdminAssistantOperations>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListAdminAssistantOperationsQueryResult = NonNullable<Awaited<ReturnType<typeof listAdminAssistantOperations>>>;
export type ListAdminAssistantOperationsQueryError = ErrorType<unknown>;
export declare function useListAdminAssistantOperations<TData = Awaited<ReturnType<typeof listAdminAssistantOperations>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAdminAssistantOperations>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateAssistantAvailabilityUrl: () => string;
export declare const updateAssistantAvailability: (assistantAvailability: AssistantAvailability, options?: Parameters<typeof customFetch>[1]) => Promise<AssistantAvailability>;
export declare const getUpdateAssistantAvailabilityMutationKey: () => readonly ["updateAssistantAvailability"];
export declare const getUpdateAssistantAvailabilityMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateAssistantAvailability>>, TError, UpdateAssistantAvailabilityMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateAssistantAvailability>>, TError, UpdateAssistantAvailabilityMutationVariables, TContext>;
export type UpdateAssistantAvailabilityMutationResult = NonNullable<Awaited<ReturnType<typeof updateAssistantAvailability>>>;
export type UpdateAssistantAvailabilityMutationBody = BodyType<AssistantAvailability>;
export type UpdateAssistantAvailabilityMutationError = ErrorType<unknown>;
export type UpdateAssistantAvailabilityMutationVariables = {
    data: BodyType<AssistantAvailability>;
};
export declare const useUpdateAssistantAvailability: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateAssistantAvailability>>, TError, UpdateAssistantAvailabilityMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateAssistantAvailability>>, TError, UpdateAssistantAvailabilityMutationVariables, TContext>;
export declare const getGenerateWorksheetActivityUrl: () => string;
/**
 * @summary Generate a printable worksheet honoring explicit teacher constraints
 */
export declare const generateWorksheetActivity: (worksheetActivityInput: WorksheetActivityInput, options?: Parameters<typeof customFetch>[1]) => Promise<WorksheetActivityResult>;
export declare const getGenerateWorksheetActivityMutationKey: () => readonly ["generateWorksheetActivity"];
export declare const getGenerateWorksheetActivityMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateWorksheetActivity>>, TError, GenerateWorksheetActivityMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof generateWorksheetActivity>>, TError, GenerateWorksheetActivityMutationVariables, TContext>;
export type GenerateWorksheetActivityMutationResult = NonNullable<Awaited<ReturnType<typeof generateWorksheetActivity>>>;
export type GenerateWorksheetActivityMutationBody = BodyType<WorksheetActivityInput>;
export type GenerateWorksheetActivityMutationError = ErrorType<void>;
export type GenerateWorksheetActivityMutationVariables = {
    data: BodyType<WorksheetActivityInput>;
};
/**
* @summary Generate a printable worksheet honoring explicit teacher constraints
*/
export declare const useGenerateWorksheetActivity: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateWorksheetActivity>>, TError, GenerateWorksheetActivityMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof generateWorksheetActivity>>, TError, GenerateWorksheetActivityMutationVariables, TContext>;
export declare const getExtractWorksheetActivityUrl: () => string;
/**
 * @summary Build printable activities grounded in educational source material
 */
export declare const extractWorksheetActivity: (worksheetActivitySourceInput: WorksheetActivitySourceInput, options?: Parameters<typeof customFetch>[1]) => Promise<WorksheetActivityResult>;
export declare const getExtractWorksheetActivityMutationKey: () => readonly ["extractWorksheetActivity"];
export declare const getExtractWorksheetActivityMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof extractWorksheetActivity>>, TError, ExtractWorksheetActivityMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof extractWorksheetActivity>>, TError, ExtractWorksheetActivityMutationVariables, TContext>;
export type ExtractWorksheetActivityMutationResult = NonNullable<Awaited<ReturnType<typeof extractWorksheetActivity>>>;
export type ExtractWorksheetActivityMutationBody = BodyType<WorksheetActivitySourceInput>;
export type ExtractWorksheetActivityMutationError = ErrorType<void>;
export type ExtractWorksheetActivityMutationVariables = {
    data: BodyType<WorksheetActivitySourceInput>;
};
/**
* @summary Build printable activities grounded in educational source material
*/
export declare const useExtractWorksheetActivity: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof extractWorksheetActivity>>, TError, ExtractWorksheetActivityMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof extractWorksheetActivity>>, TError, ExtractWorksheetActivityMutationVariables, TContext>;
export declare const getCreateGameShareLinkUrl: () => string;
/**
 * Does not create a game or change the destination's authorization. Guest hosts may create aliases.
 * @summary Get a permanent short alias for an existing public game destination
 */
export declare const createGameShareLink: (gameShareLinkInput: GameShareLinkInput, options?: Parameters<typeof customFetch>[1]) => Promise<GameShareLink>;
export declare const getCreateGameShareLinkMutationKey: () => readonly ["createGameShareLink"];
export declare const getCreateGameShareLinkMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createGameShareLink>>, TError, CreateGameShareLinkMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createGameShareLink>>, TError, CreateGameShareLinkMutationVariables, TContext>;
export type CreateGameShareLinkMutationResult = NonNullable<Awaited<ReturnType<typeof createGameShareLink>>>;
export type CreateGameShareLinkMutationBody = BodyType<GameShareLinkInput>;
export type CreateGameShareLinkMutationError = ErrorType<void>;
export type CreateGameShareLinkMutationVariables = {
    data: BodyType<GameShareLinkInput>;
};
/**
* @summary Get a permanent short alias for an existing public game destination
*/
export declare const useCreateGameShareLink: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createGameShareLink>>, TError, CreateGameShareLinkMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createGameShareLink>>, TError, CreateGameShareLinkMutationVariables, TContext>;
export declare const getResolveGameShareLinkUrl: (code: string) => string;
/**
 * @summary Redirect anonymously to the original game URL
 */
export declare const resolveGameShareLink: (code: string, options?: Parameters<typeof customFetch>[1]) => Promise<unknown>;
export declare const getResolveGameShareLinkQueryKey: (code: string) => readonly [`/api/game-share-links/${string}/redirect`];
export declare const getResolveGameShareLinkQueryOptions: <TData = Awaited<ReturnType<typeof resolveGameShareLink>>, TError = ErrorType<void>>(code: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof resolveGameShareLink>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof resolveGameShareLink>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ResolveGameShareLinkQueryResult = NonNullable<Awaited<ReturnType<typeof resolveGameShareLink>>>;
export type ResolveGameShareLinkQueryError = ErrorType<void>;
/**
 * @summary Redirect anonymously to the original game URL
 */
export declare function useResolveGameShareLink<TData = Awaited<ReturnType<typeof resolveGameShareLink>>, TError = ErrorType<void>>(code: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof resolveGameShareLink>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getRenderWorksheetPageUrl: (id: number) => string;
/**
 * Requires worksheet ownership or access to a published admin-shared worksheet. Runs in an isolated browser without executing submitted JavaScript or accessing the server session.
 * @summary Render one worksheet page as a browser-native PNG
 */
export declare const renderWorksheetPage: (id: number, worksheetPageRenderInput: WorksheetPageRenderInput, options?: Parameters<typeof customFetch>[1]) => Promise<Blob>;
export declare const getRenderWorksheetPageMutationKey: () => readonly ["renderWorksheetPage"];
export declare const getRenderWorksheetPageMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof renderWorksheetPage>>, TError, RenderWorksheetPageMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof renderWorksheetPage>>, TError, RenderWorksheetPageMutationVariables, TContext>;
export type RenderWorksheetPageMutationResult = NonNullable<Awaited<ReturnType<typeof renderWorksheetPage>>>;
export type RenderWorksheetPageMutationBody = BodyType<WorksheetPageRenderInput>;
export type RenderWorksheetPageMutationError = ErrorType<void>;
export type RenderWorksheetPageMutationVariables = {
    id: number;
    data: BodyType<WorksheetPageRenderInput>;
};
/**
* @summary Render one worksheet page as a browser-native PNG
*/
export declare const useRenderWorksheetPage: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof renderWorksheetPage>>, TError, RenderWorksheetPageMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof renderWorksheetPage>>, TError, RenderWorksheetPageMutationVariables, TContext>;
export declare const getGetTutorialLinksUrl: () => string;
/**
 * @summary Get configured YouTube tutorial links
 */
export declare const getTutorialLinks: (options?: Parameters<typeof customFetch>[1]) => Promise<TutorialLinks>;
export declare const getGetTutorialLinksQueryKey: () => readonly ["/api/tutorials"];
export declare const getGetTutorialLinksQueryOptions: <TData = Awaited<ReturnType<typeof getTutorialLinks>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTutorialLinks>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getTutorialLinks>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetTutorialLinksQueryResult = NonNullable<Awaited<ReturnType<typeof getTutorialLinks>>>;
export type GetTutorialLinksQueryError = ErrorType<unknown>;
/**
 * @summary Get configured YouTube tutorial links
 */
export declare function useGetTutorialLinks<TData = Awaited<ReturnType<typeof getTutorialLinks>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTutorialLinks>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getSaveTutorialLinksUrl: () => string;
/**
 * @summary Replace tutorial links (administrator only)
 */
export declare const saveTutorialLinks: (tutorialLinks: TutorialLinks, options?: Parameters<typeof customFetch>[1]) => Promise<TutorialLinks>;
export declare const getSaveTutorialLinksMutationKey: () => readonly ["saveTutorialLinks"];
export declare const getSaveTutorialLinksMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof saveTutorialLinks>>, TError, SaveTutorialLinksMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof saveTutorialLinks>>, TError, SaveTutorialLinksMutationVariables, TContext>;
export type SaveTutorialLinksMutationResult = NonNullable<Awaited<ReturnType<typeof saveTutorialLinks>>>;
export type SaveTutorialLinksMutationBody = BodyType<TutorialLinks>;
export type SaveTutorialLinksMutationError = ErrorType<void>;
export type SaveTutorialLinksMutationVariables = {
    data: BodyType<TutorialLinks>;
};
/**
* @summary Replace tutorial links (administrator only)
*/
export declare const useSaveTutorialLinks: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof saveTutorialLinks>>, TError, SaveTutorialLinksMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof saveTutorialLinks>>, TError, SaveTutorialLinksMutationVariables, TContext>;
export declare const getHealthCheckUrl: () => string;
/**
 * @summary Health check
 */
export declare const healthCheck: (options?: Parameters<typeof customFetch>[1]) => Promise<HealthStatus>;
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
export declare const getRegisterTeacherUrl: () => string;
/**
 * @summary Register a new teacher
 */
export declare const registerTeacher: (registerTeacherBody: RegisterTeacherBody, options?: Parameters<typeof customFetch>[1]) => Promise<AuthResponse>;
export declare const getRegisterTeacherMutationKey: () => readonly ["registerTeacher"];
export declare const getRegisterTeacherMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof registerTeacher>>, TError, RegisterTeacherMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof registerTeacher>>, TError, RegisterTeacherMutationVariables, TContext>;
export type RegisterTeacherMutationResult = NonNullable<Awaited<ReturnType<typeof registerTeacher>>>;
export type RegisterTeacherMutationBody = BodyType<RegisterTeacherBody>;
export type RegisterTeacherMutationError = ErrorType<ErrorResponse>;
export type RegisterTeacherMutationVariables = {
    data: BodyType<RegisterTeacherBody>;
};
/**
* @summary Register a new teacher
*/
export declare const useRegisterTeacher: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof registerTeacher>>, TError, RegisterTeacherMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof registerTeacher>>, TError, RegisterTeacherMutationVariables, TContext>;
export declare const getLoginTeacherUrl: () => string;
/**
 * @summary Teacher login
 */
export declare const loginTeacher: (loginTeacherBody: LoginTeacherBody, options?: Parameters<typeof customFetch>[1]) => Promise<AuthResponse>;
export declare const getLoginTeacherMutationKey: () => readonly ["loginTeacher"];
export declare const getLoginTeacherMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof loginTeacher>>, TError, LoginTeacherMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof loginTeacher>>, TError, LoginTeacherMutationVariables, TContext>;
export type LoginTeacherMutationResult = NonNullable<Awaited<ReturnType<typeof loginTeacher>>>;
export type LoginTeacherMutationBody = BodyType<LoginTeacherBody>;
export type LoginTeacherMutationError = ErrorType<ErrorResponse>;
export type LoginTeacherMutationVariables = {
    data: BodyType<LoginTeacherBody>;
};
/**
* @summary Teacher login
*/
export declare const useLoginTeacher: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof loginTeacher>>, TError, LoginTeacherMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof loginTeacher>>, TError, LoginTeacherMutationVariables, TContext>;
export declare const getGetCurrentTeacherUrl: () => string;
/**
 * @summary Get current teacher info
 */
export declare const getCurrentTeacher: (options?: Parameters<typeof customFetch>[1]) => Promise<TeacherProfile>;
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
export declare const getUpdateTeacherProfileUrl: () => string;
/**
 * @summary Update teacher profile
 */
export declare const updateTeacherProfile: (updateProfileBody: UpdateProfileBody, options?: Parameters<typeof customFetch>[1]) => Promise<TeacherProfile>;
export declare const getUpdateTeacherProfileMutationKey: () => readonly ["updateTeacherProfile"];
export declare const getUpdateTeacherProfileMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTeacherProfile>>, TError, UpdateTeacherProfileMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateTeacherProfile>>, TError, UpdateTeacherProfileMutationVariables, TContext>;
export type UpdateTeacherProfileMutationResult = NonNullable<Awaited<ReturnType<typeof updateTeacherProfile>>>;
export type UpdateTeacherProfileMutationBody = BodyType<UpdateProfileBody>;
export type UpdateTeacherProfileMutationError = ErrorType<void>;
export type UpdateTeacherProfileMutationVariables = {
    data: BodyType<UpdateProfileBody>;
};
/**
* @summary Update teacher profile
*/
export declare const useUpdateTeacherProfile: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTeacherProfile>>, TError, UpdateTeacherProfileMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateTeacherProfile>>, TError, UpdateTeacherProfileMutationVariables, TContext>;
export declare const getUpdateTeacherRoleUrl: () => string;
/**
 * @summary Change current user's role (teacher ↔ organizer)
 */
export declare const updateTeacherRole: (updateRoleBody: UpdateRoleBody, options?: Parameters<typeof customFetch>[1]) => Promise<TeacherProfile>;
export declare const getUpdateTeacherRoleMutationKey: () => readonly ["updateTeacherRole"];
export declare const getUpdateTeacherRoleMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTeacherRole>>, TError, UpdateTeacherRoleMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateTeacherRole>>, TError, UpdateTeacherRoleMutationVariables, TContext>;
export type UpdateTeacherRoleMutationResult = NonNullable<Awaited<ReturnType<typeof updateTeacherRole>>>;
export type UpdateTeacherRoleMutationBody = BodyType<UpdateRoleBody>;
export type UpdateTeacherRoleMutationError = ErrorType<ErrorResponse>;
export type UpdateTeacherRoleMutationVariables = {
    data: BodyType<UpdateRoleBody>;
};
/**
* @summary Change current user's role (teacher ↔ organizer)
*/
export declare const useUpdateTeacherRole: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTeacherRole>>, TError, UpdateTeacherRoleMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateTeacherRole>>, TError, UpdateTeacherRoleMutationVariables, TContext>;
export declare const getLogoutTeacherUrl: () => string;
/**
 * @summary Logout teacher
 */
export declare const logoutTeacher: (options?: Parameters<typeof customFetch>[1]) => Promise<SuccessResponse>;
export declare const getLogoutTeacherMutationKey: () => readonly ["logoutTeacher"];
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
export declare const getLoginTeacherWithGoogleUrl: () => string;
/**
 * @summary Login or register a teacher using a Google ID token
 */
export declare const loginTeacherWithGoogle: (googleLoginBody: GoogleLoginBody, options?: Parameters<typeof customFetch>[1]) => Promise<AuthResponse>;
export declare const getLoginTeacherWithGoogleMutationKey: () => readonly ["loginTeacherWithGoogle"];
export declare const getLoginTeacherWithGoogleMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof loginTeacherWithGoogle>>, TError, LoginTeacherWithGoogleMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof loginTeacherWithGoogle>>, TError, LoginTeacherWithGoogleMutationVariables, TContext>;
export type LoginTeacherWithGoogleMutationResult = NonNullable<Awaited<ReturnType<typeof loginTeacherWithGoogle>>>;
export type LoginTeacherWithGoogleMutationBody = BodyType<GoogleLoginBody>;
export type LoginTeacherWithGoogleMutationError = ErrorType<ErrorResponse>;
export type LoginTeacherWithGoogleMutationVariables = {
    data: BodyType<GoogleLoginBody>;
};
/**
* @summary Login or register a teacher using a Google ID token
*/
export declare const useLoginTeacherWithGoogle: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof loginTeacherWithGoogle>>, TError, LoginTeacherWithGoogleMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof loginTeacherWithGoogle>>, TError, LoginTeacherWithGoogleMutationVariables, TContext>;
export declare const getGetBriefPreferencesUrl: () => string;
/**
 * @summary Get the teacher's saved brief preferences
 */
export declare const getBriefPreferences: (options?: Parameters<typeof customFetch>[1]) => Promise<BriefPreferences>;
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
export declare const getUpdateBriefPreferencesUrl: () => string;
/**
 * @summary Persist the teacher's brief preferences server-side
 */
export declare const updateBriefPreferences: (briefPreferences: BriefPreferences, options?: Parameters<typeof customFetch>[1]) => Promise<BriefPreferences>;
export declare const getUpdateBriefPreferencesMutationKey: () => readonly ["updateBriefPreferences"];
export declare const getUpdateBriefPreferencesMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateBriefPreferences>>, TError, UpdateBriefPreferencesMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateBriefPreferences>>, TError, UpdateBriefPreferencesMutationVariables, TContext>;
export type UpdateBriefPreferencesMutationResult = NonNullable<Awaited<ReturnType<typeof updateBriefPreferences>>>;
export type UpdateBriefPreferencesMutationBody = BodyType<BriefPreferences>;
export type UpdateBriefPreferencesMutationError = ErrorType<ErrorResponse>;
export type UpdateBriefPreferencesMutationVariables = {
    data: BodyType<BriefPreferences>;
};
/**
* @summary Persist the teacher's brief preferences server-side
*/
export declare const useUpdateBriefPreferences: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateBriefPreferences>>, TError, UpdateBriefPreferencesMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateBriefPreferences>>, TError, UpdateBriefPreferencesMutationVariables, TContext>;
export declare const getListTeacherSessionsUrl: () => string;
/**
 * @summary List active sessions for the current teacher
 */
export declare const listTeacherSessions: (options?: Parameters<typeof customFetch>[1]) => Promise<TeacherSession[]>;
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
export declare const getRevokeOtherTeacherSessionsUrl: () => string;
/**
 * @summary Revoke all sessions for the current teacher except the current one
 */
export declare const revokeOtherTeacherSessions: (options?: Parameters<typeof customFetch>[1]) => Promise<RevokeSessionsResponse>;
export declare const getRevokeOtherTeacherSessionsMutationKey: () => readonly ["revokeOtherTeacherSessions"];
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
export declare const getRevokeTeacherSessionUrl: (sid: string) => string;
/**
 * @summary Revoke a specific session for the current teacher
 */
export declare const revokeTeacherSession: (sid: string, options?: Parameters<typeof customFetch>[1]) => Promise<RevokeSessionResponse>;
export declare const getRevokeTeacherSessionMutationKey: () => readonly ["revokeTeacherSession"];
export declare const getRevokeTeacherSessionMutationOptions: <TError = ErrorType<void | ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof revokeTeacherSession>>, TError, RevokeTeacherSessionMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof revokeTeacherSession>>, TError, RevokeTeacherSessionMutationVariables, TContext>;
export type RevokeTeacherSessionMutationResult = NonNullable<Awaited<ReturnType<typeof revokeTeacherSession>>>;
export type RevokeTeacherSessionMutationError = ErrorType<void | ErrorResponse>;
export type RevokeTeacherSessionMutationVariables = {
    sid: string;
};
/**
* @summary Revoke a specific session for the current teacher
*/
export declare const useRevokeTeacherSession: <TError = ErrorType<void | ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof revokeTeacherSession>>, TError, RevokeTeacherSessionMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof revokeTeacherSession>>, TError, RevokeTeacherSessionMutationVariables, TContext>;
export declare const getAdminHideAssignmentUrl: (id: number) => string;
/**
 * @summary Hide a shared assignment from the public library (admin only)
 */
export declare const adminHideAssignment: (id: number, adminHideAssignmentBody?: AdminHideAssignmentBody, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getAdminHideAssignmentMutationKey: () => readonly ["adminHideAssignment"];
export declare const getAdminHideAssignmentMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof adminHideAssignment>>, TError, AdminHideAssignmentMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof adminHideAssignment>>, TError, AdminHideAssignmentMutationVariables, TContext>;
export type AdminHideAssignmentMutationResult = NonNullable<Awaited<ReturnType<typeof adminHideAssignment>>>;
export type AdminHideAssignmentMutationBody = BodyType<AdminHideAssignmentBody> | undefined;
export type AdminHideAssignmentMutationError = ErrorType<void>;
export type AdminHideAssignmentMutationVariables = {
    id: number;
    data?: BodyType<AdminHideAssignmentBody>;
};
/**
* @summary Hide a shared assignment from the public library (admin only)
*/
export declare const useAdminHideAssignment: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof adminHideAssignment>>, TError, AdminHideAssignmentMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof adminHideAssignment>>, TError, AdminHideAssignmentMutationVariables, TContext>;
export declare const getAdminUnhideAssignmentUrl: (id: number) => string;
/**
 * @summary Restore a previously hidden assignment to the public library
 */
export declare const adminUnhideAssignment: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getAdminUnhideAssignmentMutationKey: () => readonly ["adminUnhideAssignment"];
export declare const getAdminUnhideAssignmentMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof adminUnhideAssignment>>, TError, AdminUnhideAssignmentMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof adminUnhideAssignment>>, TError, AdminUnhideAssignmentMutationVariables, TContext>;
export type AdminUnhideAssignmentMutationResult = NonNullable<Awaited<ReturnType<typeof adminUnhideAssignment>>>;
export type AdminUnhideAssignmentMutationError = ErrorType<void>;
export type AdminUnhideAssignmentMutationVariables = {
    id: number;
};
/**
* @summary Restore a previously hidden assignment to the public library
*/
export declare const useAdminUnhideAssignment: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof adminUnhideAssignment>>, TError, AdminUnhideAssignmentMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof adminUnhideAssignment>>, TError, AdminUnhideAssignmentMutationVariables, TContext>;
export declare const getAdminHideQuestionBankItemUrl: (id: number) => string;
/**
 * @summary Hide a shared question-bank item from the public library
 */
export declare const adminHideQuestionBankItem: (id: number, adminHideQuestionBankItemBody?: AdminHideQuestionBankItemBody, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getAdminHideQuestionBankItemMutationKey: () => readonly ["adminHideQuestionBankItem"];
export declare const getAdminHideQuestionBankItemMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof adminHideQuestionBankItem>>, TError, AdminHideQuestionBankItemMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof adminHideQuestionBankItem>>, TError, AdminHideQuestionBankItemMutationVariables, TContext>;
export type AdminHideQuestionBankItemMutationResult = NonNullable<Awaited<ReturnType<typeof adminHideQuestionBankItem>>>;
export type AdminHideQuestionBankItemMutationBody = BodyType<AdminHideQuestionBankItemBody> | undefined;
export type AdminHideQuestionBankItemMutationError = ErrorType<void>;
export type AdminHideQuestionBankItemMutationVariables = {
    id: number;
    data?: BodyType<AdminHideQuestionBankItemBody>;
};
/**
* @summary Hide a shared question-bank item from the public library
*/
export declare const useAdminHideQuestionBankItem: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof adminHideQuestionBankItem>>, TError, AdminHideQuestionBankItemMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof adminHideQuestionBankItem>>, TError, AdminHideQuestionBankItemMutationVariables, TContext>;
export declare const getAdminUnhideQuestionBankItemUrl: (id: number) => string;
/**
 * @summary Restore a hidden question-bank item to the public library
 */
export declare const adminUnhideQuestionBankItem: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getAdminUnhideQuestionBankItemMutationKey: () => readonly ["adminUnhideQuestionBankItem"];
export declare const getAdminUnhideQuestionBankItemMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof adminUnhideQuestionBankItem>>, TError, AdminUnhideQuestionBankItemMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof adminUnhideQuestionBankItem>>, TError, AdminUnhideQuestionBankItemMutationVariables, TContext>;
export type AdminUnhideQuestionBankItemMutationResult = NonNullable<Awaited<ReturnType<typeof adminUnhideQuestionBankItem>>>;
export type AdminUnhideQuestionBankItemMutationError = ErrorType<void>;
export type AdminUnhideQuestionBankItemMutationVariables = {
    id: number;
};
/**
* @summary Restore a hidden question-bank item to the public library
*/
export declare const useAdminUnhideQuestionBankItem: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof adminUnhideQuestionBankItem>>, TError, AdminUnhideQuestionBankItemMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof adminUnhideQuestionBankItem>>, TError, AdminUnhideQuestionBankItemMutationVariables, TContext>;
export declare const getAdminHideVideoLessonUrl: (id: number) => string;
/**
 * @summary Hide a shared video lesson from the public library
 */
export declare const adminHideVideoLesson: (id: number, adminHideVideoLessonBody?: AdminHideVideoLessonBody, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getAdminHideVideoLessonMutationKey: () => readonly ["adminHideVideoLesson"];
export declare const getAdminHideVideoLessonMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof adminHideVideoLesson>>, TError, AdminHideVideoLessonMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof adminHideVideoLesson>>, TError, AdminHideVideoLessonMutationVariables, TContext>;
export type AdminHideVideoLessonMutationResult = NonNullable<Awaited<ReturnType<typeof adminHideVideoLesson>>>;
export type AdminHideVideoLessonMutationBody = BodyType<AdminHideVideoLessonBody> | undefined;
export type AdminHideVideoLessonMutationError = ErrorType<void>;
export type AdminHideVideoLessonMutationVariables = {
    id: number;
    data?: BodyType<AdminHideVideoLessonBody>;
};
/**
* @summary Hide a shared video lesson from the public library
*/
export declare const useAdminHideVideoLesson: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof adminHideVideoLesson>>, TError, AdminHideVideoLessonMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof adminHideVideoLesson>>, TError, AdminHideVideoLessonMutationVariables, TContext>;
export declare const getAdminUnhideVideoLessonUrl: (id: number) => string;
/**
 * @summary Restore a hidden video lesson to the public library
 */
export declare const adminUnhideVideoLesson: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getAdminUnhideVideoLessonMutationKey: () => readonly ["adminUnhideVideoLesson"];
export declare const getAdminUnhideVideoLessonMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof adminUnhideVideoLesson>>, TError, AdminUnhideVideoLessonMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof adminUnhideVideoLesson>>, TError, AdminUnhideVideoLessonMutationVariables, TContext>;
export type AdminUnhideVideoLessonMutationResult = NonNullable<Awaited<ReturnType<typeof adminUnhideVideoLesson>>>;
export type AdminUnhideVideoLessonMutationError = ErrorType<void>;
export type AdminUnhideVideoLessonMutationVariables = {
    id: number;
};
/**
* @summary Restore a hidden video lesson to the public library
*/
export declare const useAdminUnhideVideoLesson: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof adminUnhideVideoLesson>>, TError, AdminUnhideVideoLessonMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof adminUnhideVideoLesson>>, TError, AdminUnhideVideoLessonMutationVariables, TContext>;
export declare const getListAdminDirectoryUrl: (kind: "teachers" | "students" | "activities", params?: ListAdminDirectoryParams) => string;
/**
 * @summary Search a paginated admin directory across all matching records
 */
export declare const listAdminDirectory: (kind: "teachers" | "students" | "activities", params?: ListAdminDirectoryParams, options?: Parameters<typeof customFetch>[1]) => Promise<AdminDirectoryPage>;
export declare const getListAdminDirectoryQueryKey: (kind: "teachers" | "students" | "activities", params?: ListAdminDirectoryParams) => readonly ["/api/admin/directory/teachers" | "/api/admin/directory/students" | "/api/admin/directory/activities", ...ListAdminDirectoryParams[]];
export declare const getListAdminDirectoryQueryOptions: <TData = Awaited<ReturnType<typeof listAdminDirectory>>, TError = ErrorType<void>>(kind: "teachers" | "students" | "activities", params?: ListAdminDirectoryParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAdminDirectory>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listAdminDirectory>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListAdminDirectoryQueryResult = NonNullable<Awaited<ReturnType<typeof listAdminDirectory>>>;
export type ListAdminDirectoryQueryError = ErrorType<void>;
/**
 * @summary Search a paginated admin directory across all matching records
 */
export declare function useListAdminDirectory<TData = Awaited<ReturnType<typeof listAdminDirectory>>, TError = ErrorType<void>>(kind: 'teachers' | 'students' | 'activities', params?: ListAdminDirectoryParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAdminDirectory>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListAllTeachersUrl: () => string;
/**
 * @summary List all registered teachers with stats
 */
export declare const listAllTeachers: (options?: Parameters<typeof customFetch>[1]) => Promise<AdminTeacherSummary[]>;
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
export declare const getListAssignmentsUrl: (params?: ListAssignmentsParams) => string;
/**
 * @summary List all assignments
 */
export declare const listAssignments: (params?: ListAssignmentsParams, options?: Parameters<typeof customFetch>[1]) => Promise<Assignment[]>;
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
export declare const getCreateAssignmentUrl: () => string;
/**
 * @summary Create a new assignment
 */
export declare const createAssignment: (createAssignmentBody: CreateAssignmentBody, options?: Parameters<typeof customFetch>[1]) => Promise<Assignment>;
export declare const getCreateAssignmentMutationKey: () => readonly ["createAssignment"];
export declare const getCreateAssignmentMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAssignment>>, TError, CreateAssignmentMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createAssignment>>, TError, CreateAssignmentMutationVariables, TContext>;
export type CreateAssignmentMutationResult = NonNullable<Awaited<ReturnType<typeof createAssignment>>>;
export type CreateAssignmentMutationBody = BodyType<CreateAssignmentBody>;
export type CreateAssignmentMutationError = ErrorType<unknown>;
export type CreateAssignmentMutationVariables = {
    data: BodyType<CreateAssignmentBody>;
};
/**
* @summary Create a new assignment
*/
export declare const useCreateAssignment: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAssignment>>, TError, CreateAssignmentMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createAssignment>>, TError, CreateAssignmentMutationVariables, TContext>;
export declare const getGetAssignmentUrl: (id: number) => string;
/**
 * @summary Get assignment with questions
 */
export declare const getAssignment: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<AssignmentWithQuestions>;
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
export declare const getDeleteAssignmentUrl: (id: number) => string;
/**
 * @summary Delete an assignment
 */
export declare const deleteAssignment: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<SuccessResponse>;
export declare const getDeleteAssignmentMutationKey: () => readonly ["deleteAssignment"];
export declare const getDeleteAssignmentMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteAssignment>>, TError, DeleteAssignmentMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteAssignment>>, TError, DeleteAssignmentMutationVariables, TContext>;
export type DeleteAssignmentMutationResult = NonNullable<Awaited<ReturnType<typeof deleteAssignment>>>;
export type DeleteAssignmentMutationError = ErrorType<unknown>;
export type DeleteAssignmentMutationVariables = {
    id: number;
};
/**
* @summary Delete an assignment
*/
export declare const useDeleteAssignment: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteAssignment>>, TError, DeleteAssignmentMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteAssignment>>, TError, DeleteAssignmentMutationVariables, TContext>;
export declare const getStartExamSessionUrl: (id: number) => string;
/**
 * @summary Start an exam session (server-side timing)
 */
export declare const startExamSession: (id: number, startExamBody: StartExamBody, options?: Parameters<typeof customFetch>[1]) => Promise<ExamSessionResponse>;
export declare const getStartExamSessionMutationKey: () => readonly ["startExamSession"];
export declare const getStartExamSessionMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof startExamSession>>, TError, StartExamSessionMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof startExamSession>>, TError, StartExamSessionMutationVariables, TContext>;
export type StartExamSessionMutationResult = NonNullable<Awaited<ReturnType<typeof startExamSession>>>;
export type StartExamSessionMutationBody = BodyType<StartExamBody>;
export type StartExamSessionMutationError = ErrorType<unknown>;
export type StartExamSessionMutationVariables = {
    id: number;
    data: BodyType<StartExamBody>;
};
/**
* @summary Start an exam session (server-side timing)
*/
export declare const useStartExamSession: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof startExamSession>>, TError, StartExamSessionMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof startExamSession>>, TError, StartExamSessionMutationVariables, TContext>;
export declare const getUpdateAssignmentLifecycleUrl: (id: number) => string;
/**
 * @summary Close or reopen an assignment for new student work
 */
export declare const updateAssignmentLifecycle: (id: number, updateAssignmentLifecycleBody: UpdateAssignmentLifecycleBody, options?: Parameters<typeof customFetch>[1]) => Promise<UpdateAssignmentLifecycleResponse>;
export declare const getUpdateAssignmentLifecycleMutationKey: () => readonly ["updateAssignmentLifecycle"];
export declare const getUpdateAssignmentLifecycleMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateAssignmentLifecycle>>, TError, UpdateAssignmentLifecycleMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateAssignmentLifecycle>>, TError, UpdateAssignmentLifecycleMutationVariables, TContext>;
export type UpdateAssignmentLifecycleMutationResult = NonNullable<Awaited<ReturnType<typeof updateAssignmentLifecycle>>>;
export type UpdateAssignmentLifecycleMutationBody = BodyType<UpdateAssignmentLifecycleBody>;
export type UpdateAssignmentLifecycleMutationError = ErrorType<ErrorResponse>;
export type UpdateAssignmentLifecycleMutationVariables = {
    id: number;
    data: BodyType<UpdateAssignmentLifecycleBody>;
};
/**
* @summary Close or reopen an assignment for new student work
*/
export declare const useUpdateAssignmentLifecycle: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateAssignmentLifecycle>>, TError, UpdateAssignmentLifecycleMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateAssignmentLifecycle>>, TError, UpdateAssignmentLifecycleMutationVariables, TContext>;
export declare const getSubmitAssignmentUrl: (id: number) => string;
/**
 * @summary Submit answers for an assignment
 */
export declare const submitAssignment: (id: number, submitAssignmentBody: SubmitAssignmentBody, options?: Parameters<typeof customFetch>[1]) => Promise<SubmissionResult>;
export declare const getSubmitAssignmentMutationKey: () => readonly ["submitAssignment"];
export declare const getSubmitAssignmentMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof submitAssignment>>, TError, SubmitAssignmentMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof submitAssignment>>, TError, SubmitAssignmentMutationVariables, TContext>;
export type SubmitAssignmentMutationResult = NonNullable<Awaited<ReturnType<typeof submitAssignment>>>;
export type SubmitAssignmentMutationBody = BodyType<SubmitAssignmentBody>;
export type SubmitAssignmentMutationError = ErrorType<unknown>;
export type SubmitAssignmentMutationVariables = {
    id: number;
    data: BodyType<SubmitAssignmentBody>;
};
/**
* @summary Submit answers for an assignment
*/
export declare const useSubmitAssignment: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof submitAssignment>>, TError, SubmitAssignmentMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof submitAssignment>>, TError, SubmitAssignmentMutationVariables, TContext>;
export declare const getSubmitAssignmentImageUrl: (id: number) => string;
/**
 * @summary Submit assignment via uploaded image
 */
export declare const submitAssignmentImage: (id: number, submitImageBody: SubmitImageBody, options?: Parameters<typeof customFetch>[1]) => Promise<SubmissionResult>;
export declare const getSubmitAssignmentImageMutationKey: () => readonly ["submitAssignmentImage"];
export declare const getSubmitAssignmentImageMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof submitAssignmentImage>>, TError, SubmitAssignmentImageMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof submitAssignmentImage>>, TError, SubmitAssignmentImageMutationVariables, TContext>;
export type SubmitAssignmentImageMutationResult = NonNullable<Awaited<ReturnType<typeof submitAssignmentImage>>>;
export type SubmitAssignmentImageMutationBody = BodyType<SubmitImageBody>;
export type SubmitAssignmentImageMutationError = ErrorType<unknown>;
export type SubmitAssignmentImageMutationVariables = {
    id: number;
    data: BodyType<SubmitImageBody>;
};
/**
* @summary Submit assignment via uploaded image
*/
export declare const useSubmitAssignmentImage: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof submitAssignmentImage>>, TError, SubmitAssignmentImageMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof submitAssignmentImage>>, TError, SubmitAssignmentImageMutationVariables, TContext>;
export declare const getListSubmissionsUrl: (id: number) => string;
/**
 * @summary List submissions for an assignment
 */
export declare const listSubmissions: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<Submission[]>;
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
export declare const getDeleteAssignmentSubmissionsUrl: (id: number) => string;
/**
 * @summary Delete every submission for an assignment while keeping the assignment
 */
export declare const deleteAssignmentSubmissions: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<DeletedSubmissionsResult>;
export declare const getDeleteAssignmentSubmissionsMutationKey: () => readonly ["deleteAssignmentSubmissions"];
export declare const getDeleteAssignmentSubmissionsMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteAssignmentSubmissions>>, TError, DeleteAssignmentSubmissionsMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteAssignmentSubmissions>>, TError, DeleteAssignmentSubmissionsMutationVariables, TContext>;
export type DeleteAssignmentSubmissionsMutationResult = NonNullable<Awaited<ReturnType<typeof deleteAssignmentSubmissions>>>;
export type DeleteAssignmentSubmissionsMutationError = ErrorType<ErrorResponse>;
export type DeleteAssignmentSubmissionsMutationVariables = {
    id: number;
};
/**
* @summary Delete every submission for an assignment while keeping the assignment
*/
export declare const useDeleteAssignmentSubmissions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteAssignmentSubmissions>>, TError, DeleteAssignmentSubmissionsMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteAssignmentSubmissions>>, TError, DeleteAssignmentSubmissionsMutationVariables, TContext>;
export declare const getExportSubmissionsCsvUrl: (id: number) => string;
/**
 * @summary Export submissions as CSV
 */
export declare const exportSubmissionsCsv: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<string>;
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
export declare const getUpdateSubmissionUrl: (submissionId: number) => string;
/**
 * @summary Update submission grade (teacher only)
 */
export declare const updateSubmission: (submissionId: number, updateSubmissionBody: UpdateSubmissionBody, options?: Parameters<typeof customFetch>[1]) => Promise<Submission>;
export declare const getUpdateSubmissionMutationKey: () => readonly ["updateSubmission"];
export declare const getUpdateSubmissionMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateSubmission>>, TError, UpdateSubmissionMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateSubmission>>, TError, UpdateSubmissionMutationVariables, TContext>;
export type UpdateSubmissionMutationResult = NonNullable<Awaited<ReturnType<typeof updateSubmission>>>;
export type UpdateSubmissionMutationBody = BodyType<UpdateSubmissionBody>;
export type UpdateSubmissionMutationError = ErrorType<unknown>;
export type UpdateSubmissionMutationVariables = {
    submissionId: number;
    data: BodyType<UpdateSubmissionBody>;
};
/**
* @summary Update submission grade (teacher only)
*/
export declare const useUpdateSubmission: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateSubmission>>, TError, UpdateSubmissionMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateSubmission>>, TError, UpdateSubmissionMutationVariables, TContext>;
export declare const getGetSubmissionDetailsUrl: (submissionId: number) => string;
/**
 * @summary Get full submission with per-answer details (teacher only)
 */
export declare const getSubmissionDetails: (submissionId: number, options?: Parameters<typeof customFetch>[1]) => Promise<SubmissionDetail>;
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
export declare const getUpdateAnswerGradeUrl: (answerId: number) => string;
/**
 * @summary Manually grade a single answer (teacher only)
 */
export declare const updateAnswerGrade: (answerId: number, updateAnswerBody: UpdateAnswerBody, options?: Parameters<typeof customFetch>[1]) => Promise<SubmissionDetail>;
export declare const getUpdateAnswerGradeMutationKey: () => readonly ["updateAnswerGrade"];
export declare const getUpdateAnswerGradeMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateAnswerGrade>>, TError, UpdateAnswerGradeMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateAnswerGrade>>, TError, UpdateAnswerGradeMutationVariables, TContext>;
export type UpdateAnswerGradeMutationResult = NonNullable<Awaited<ReturnType<typeof updateAnswerGrade>>>;
export type UpdateAnswerGradeMutationBody = BodyType<UpdateAnswerBody>;
export type UpdateAnswerGradeMutationError = ErrorType<unknown>;
export type UpdateAnswerGradeMutationVariables = {
    answerId: number;
    data: BodyType<UpdateAnswerBody>;
};
/**
* @summary Manually grade a single answer (teacher only)
*/
export declare const useUpdateAnswerGrade: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateAnswerGrade>>, TError, UpdateAnswerGradeMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateAnswerGrade>>, TError, UpdateAnswerGradeMutationVariables, TContext>;
export declare const getSubmitFeedbackUrl: () => string;
/**
 * @summary Submit feedback or suggestion
 */
export declare const submitFeedback: (submitFeedbackBody: SubmitFeedbackBody, options?: Parameters<typeof customFetch>[1]) => Promise<SuccessResponse>;
export declare const getSubmitFeedbackMutationKey: () => readonly ["submitFeedback"];
export declare const getSubmitFeedbackMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof submitFeedback>>, TError, SubmitFeedbackMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof submitFeedback>>, TError, SubmitFeedbackMutationVariables, TContext>;
export type SubmitFeedbackMutationResult = NonNullable<Awaited<ReturnType<typeof submitFeedback>>>;
export type SubmitFeedbackMutationBody = BodyType<SubmitFeedbackBody>;
export type SubmitFeedbackMutationError = ErrorType<unknown>;
export type SubmitFeedbackMutationVariables = {
    data: BodyType<SubmitFeedbackBody>;
};
/**
* @summary Submit feedback or suggestion
*/
export declare const useSubmitFeedback: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof submitFeedback>>, TError, SubmitFeedbackMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof submitFeedback>>, TError, SubmitFeedbackMutationVariables, TContext>;
export declare const getGetPresentationsLimitsUrl: () => string;
/**
 * @summary Get the effective presentations tier and limits for the caller
 */
export declare const getPresentationsLimits: (options?: Parameters<typeof customFetch>[1]) => Promise<PresentationTier>;
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
export declare const getGetPresentationUsageUrl: (id: number) => string;
/**
 * @summary Get tier limits + per-deck usage for a single presentation
 */
export declare const getPresentationUsage: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<PresentationTierWithUsage>;
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
export declare const getListPresentationsUrl: () => string;
/**
 * @summary List own presentations + admin-shared
 */
export declare const listPresentations: (options?: Parameters<typeof customFetch>[1]) => Promise<PresentationSummary[]>;
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
export declare const getCreatePresentationUrl: () => string;
/**
 * @summary Create a new presentation
 */
export declare const createPresentation: (createPresentationBody: CreatePresentationBody, options?: Parameters<typeof customFetch>[1]) => Promise<Presentation>;
export declare const getCreatePresentationMutationKey: () => readonly ["createPresentation"];
export declare const getCreatePresentationMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPresentation>>, TError, CreatePresentationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createPresentation>>, TError, CreatePresentationMutationVariables, TContext>;
export type CreatePresentationMutationResult = NonNullable<Awaited<ReturnType<typeof createPresentation>>>;
export type CreatePresentationMutationBody = BodyType<CreatePresentationBody>;
export type CreatePresentationMutationError = ErrorType<unknown>;
export type CreatePresentationMutationVariables = {
    data: BodyType<CreatePresentationBody>;
};
/**
* @summary Create a new presentation
*/
export declare const useCreatePresentation: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPresentation>>, TError, CreatePresentationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createPresentation>>, TError, CreatePresentationMutationVariables, TContext>;
export declare const getGetPresentationUrl: (id: number) => string;
/**
 * @summary Get a presentation (owner or admin-shared)
 */
export declare const getPresentation: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<Presentation>;
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
export declare const getUpdatePresentationUrl: (id: number) => string;
/**
 * @summary Update a presentation (owner only)
 */
export declare const updatePresentation: (id: number, updatePresentationBody: UpdatePresentationBody, options?: Parameters<typeof customFetch>[1]) => Promise<Presentation>;
export declare const getUpdatePresentationMutationKey: () => readonly ["updatePresentation"];
export declare const getUpdatePresentationMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePresentation>>, TError, UpdatePresentationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updatePresentation>>, TError, UpdatePresentationMutationVariables, TContext>;
export type UpdatePresentationMutationResult = NonNullable<Awaited<ReturnType<typeof updatePresentation>>>;
export type UpdatePresentationMutationBody = BodyType<UpdatePresentationBody>;
export type UpdatePresentationMutationError = ErrorType<unknown>;
export type UpdatePresentationMutationVariables = {
    id: number;
    data: BodyType<UpdatePresentationBody>;
};
/**
* @summary Update a presentation (owner only)
*/
export declare const useUpdatePresentation: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePresentation>>, TError, UpdatePresentationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updatePresentation>>, TError, UpdatePresentationMutationVariables, TContext>;
export declare const getDeletePresentationUrl: (id: number) => string;
/**
 * @summary Delete a presentation (owner only)
 */
export declare const deletePresentation: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<SuccessResponse>;
export declare const getDeletePresentationMutationKey: () => readonly ["deletePresentation"];
export declare const getDeletePresentationMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePresentation>>, TError, DeletePresentationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deletePresentation>>, TError, DeletePresentationMutationVariables, TContext>;
export type DeletePresentationMutationResult = NonNullable<Awaited<ReturnType<typeof deletePresentation>>>;
export type DeletePresentationMutationError = ErrorType<unknown>;
export type DeletePresentationMutationVariables = {
    id: number;
};
/**
* @summary Delete a presentation (owner only)
*/
export declare const useDeletePresentation: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePresentation>>, TError, DeletePresentationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deletePresentation>>, TError, DeletePresentationMutationVariables, TContext>;
export declare const getPublishPresentationUrl: (id: number) => string;
/**
 * @summary Publish a presentation (owner only)
 */
export declare const publishPresentation: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<Presentation>;
export declare const getPublishPresentationMutationKey: () => readonly ["publishPresentation"];
export declare const getPublishPresentationMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof publishPresentation>>, TError, PublishPresentationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof publishPresentation>>, TError, PublishPresentationMutationVariables, TContext>;
export type PublishPresentationMutationResult = NonNullable<Awaited<ReturnType<typeof publishPresentation>>>;
export type PublishPresentationMutationError = ErrorType<unknown>;
export type PublishPresentationMutationVariables = {
    id: number;
};
/**
* @summary Publish a presentation (owner only)
*/
export declare const usePublishPresentation: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof publishPresentation>>, TError, PublishPresentationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof publishPresentation>>, TError, PublishPresentationMutationVariables, TContext>;
export declare const getUnpublishPresentationUrl: (id: number) => string;
/**
 * @summary Move a presentation back to draft (owner only)
 */
export declare const unpublishPresentation: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<Presentation>;
export declare const getUnpublishPresentationMutationKey: () => readonly ["unpublishPresentation"];
export declare const getUnpublishPresentationMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof unpublishPresentation>>, TError, UnpublishPresentationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof unpublishPresentation>>, TError, UnpublishPresentationMutationVariables, TContext>;
export type UnpublishPresentationMutationResult = NonNullable<Awaited<ReturnType<typeof unpublishPresentation>>>;
export type UnpublishPresentationMutationError = ErrorType<unknown>;
export type UnpublishPresentationMutationVariables = {
    id: number;
};
/**
* @summary Move a presentation back to draft (owner only)
*/
export declare const useUnpublishPresentation: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof unpublishPresentation>>, TError, UnpublishPresentationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof unpublishPresentation>>, TError, UnpublishPresentationMutationVariables, TContext>;
export declare const getLinkPresentationActivityUrl: (id: number) => string;
/**
 * @summary Link or unlink the presentation to a teacher activity (assignment)
 */
export declare const linkPresentationActivity: (id: number, linkPresentationActivityBody: LinkPresentationActivityBody, options?: Parameters<typeof customFetch>[1]) => Promise<LinkPresentationActivity200>;
export declare const getLinkPresentationActivityMutationKey: () => readonly ["linkPresentationActivity"];
export declare const getLinkPresentationActivityMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof linkPresentationActivity>>, TError, LinkPresentationActivityMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof linkPresentationActivity>>, TError, LinkPresentationActivityMutationVariables, TContext>;
export type LinkPresentationActivityMutationResult = NonNullable<Awaited<ReturnType<typeof linkPresentationActivity>>>;
export type LinkPresentationActivityMutationBody = BodyType<LinkPresentationActivityBody>;
export type LinkPresentationActivityMutationError = ErrorType<unknown>;
export type LinkPresentationActivityMutationVariables = {
    id: number;
    data: BodyType<LinkPresentationActivityBody>;
};
/**
* @summary Link or unlink the presentation to a teacher activity (assignment)
*/
export declare const useLinkPresentationActivity: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof linkPresentationActivity>>, TError, LinkPresentationActivityMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof linkPresentationActivity>>, TError, LinkPresentationActivityMutationVariables, TContext>;
export declare const getGetPresentationLinkedActivityUrl: (id: number) => string;
/**
 * @summary Resolve the linked activity (or null if none / dangling)
 */
export declare const getPresentationLinkedActivity: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<GetPresentationLinkedActivity200>;
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
export declare const getDuplicatePresentationUrl: (id: number) => string;
/**
 * @summary Duplicate a presentation (owner or admin-shared)
 */
export declare const duplicatePresentation: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<Presentation>;
export declare const getDuplicatePresentationMutationKey: () => readonly ["duplicatePresentation"];
export declare const getDuplicatePresentationMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof duplicatePresentation>>, TError, DuplicatePresentationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof duplicatePresentation>>, TError, DuplicatePresentationMutationVariables, TContext>;
export type DuplicatePresentationMutationResult = NonNullable<Awaited<ReturnType<typeof duplicatePresentation>>>;
export type DuplicatePresentationMutationError = ErrorType<unknown>;
export type DuplicatePresentationMutationVariables = {
    id: number;
};
/**
* @summary Duplicate a presentation (owner or admin-shared)
*/
export declare const useDuplicatePresentation: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof duplicatePresentation>>, TError, DuplicatePresentationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof duplicatePresentation>>, TError, DuplicatePresentationMutationVariables, TContext>;
export declare const getListPresentationAssetsUrl: (id: number) => string;
/**
 * @summary List uploaded assets for a presentation
 */
export declare const listPresentationAssets: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<PresentationAsset[]>;
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
export declare const getRegisterPresentationAssetUrl: (id: number) => string;
/**
 * @summary Register an uploaded asset URL on a presentation
 */
export declare const registerPresentationAsset: (id: number, registerAssetBody: RegisterAssetBody, options?: Parameters<typeof customFetch>[1]) => Promise<PresentationAsset>;
export declare const getRegisterPresentationAssetMutationKey: () => readonly ["registerPresentationAsset"];
export declare const getRegisterPresentationAssetMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof registerPresentationAsset>>, TError, RegisterPresentationAssetMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof registerPresentationAsset>>, TError, RegisterPresentationAssetMutationVariables, TContext>;
export type RegisterPresentationAssetMutationResult = NonNullable<Awaited<ReturnType<typeof registerPresentationAsset>>>;
export type RegisterPresentationAssetMutationBody = BodyType<RegisterAssetBody>;
export type RegisterPresentationAssetMutationError = ErrorType<unknown>;
export type RegisterPresentationAssetMutationVariables = {
    id: number;
    data: BodyType<RegisterAssetBody>;
};
/**
* @summary Register an uploaded asset URL on a presentation
*/
export declare const useRegisterPresentationAsset: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof registerPresentationAsset>>, TError, RegisterPresentationAssetMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof registerPresentationAsset>>, TError, RegisterPresentationAssetMutationVariables, TContext>;
export declare const getGetPresentationAiLimitsUrl: () => string;
/**
 * @summary Tier-driven limits for AI outline generation
 */
export declare const getPresentationAiLimits: (options?: Parameters<typeof customFetch>[1]) => Promise<PresentationAiLimits>;
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
export declare const getGeneratePresentationOutlineUrl: () => string;
/**
 * @summary Generate a reviewable outline (Phase 1A) — does NOT build slides
 */
export declare const generatePresentationOutline: (presentationBrief: PresentationBrief, options?: Parameters<typeof customFetch>[1]) => Promise<PresentationDraftWithGuardrails>;
export declare const getGeneratePresentationOutlineMutationKey: () => readonly ["generatePresentationOutline"];
export declare const getGeneratePresentationOutlineMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generatePresentationOutline>>, TError, GeneratePresentationOutlineMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof generatePresentationOutline>>, TError, GeneratePresentationOutlineMutationVariables, TContext>;
export type GeneratePresentationOutlineMutationResult = NonNullable<Awaited<ReturnType<typeof generatePresentationOutline>>>;
export type GeneratePresentationOutlineMutationBody = BodyType<PresentationBrief>;
export type GeneratePresentationOutlineMutationError = ErrorType<ErrorResponse>;
export type GeneratePresentationOutlineMutationVariables = {
    data: BodyType<PresentationBrief>;
};
/**
* @summary Generate a reviewable outline (Phase 1A) — does NOT build slides
*/
export declare const useGeneratePresentationOutline: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generatePresentationOutline>>, TError, GeneratePresentationOutlineMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof generatePresentationOutline>>, TError, GeneratePresentationOutlineMutationVariables, TContext>;
export declare const getEnqueuePresentationOutlineUrl: () => string;
/**
 * @summary Enqueue durable outline generation
 */
export declare const enqueuePresentationOutline: (presentationBrief: PresentationBrief, options?: Parameters<typeof customFetch>[1]) => Promise<PresentationOutlineJob>;
export declare const getEnqueuePresentationOutlineMutationKey: () => readonly ["enqueuePresentationOutline"];
export declare const getEnqueuePresentationOutlineMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof enqueuePresentationOutline>>, TError, EnqueuePresentationOutlineMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof enqueuePresentationOutline>>, TError, EnqueuePresentationOutlineMutationVariables, TContext>;
export type EnqueuePresentationOutlineMutationResult = NonNullable<Awaited<ReturnType<typeof enqueuePresentationOutline>>>;
export type EnqueuePresentationOutlineMutationBody = BodyType<PresentationBrief>;
export type EnqueuePresentationOutlineMutationError = ErrorType<unknown>;
export type EnqueuePresentationOutlineMutationVariables = {
    data: BodyType<PresentationBrief>;
};
/**
* @summary Enqueue durable outline generation
*/
export declare const useEnqueuePresentationOutline: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof enqueuePresentationOutline>>, TError, EnqueuePresentationOutlineMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof enqueuePresentationOutline>>, TError, EnqueuePresentationOutlineMutationVariables, TContext>;
export declare const getGetPresentationOutlineJobUrl: (jobId: number) => string;
/**
 * @summary Get an owned outline job
 */
export declare const getPresentationOutlineJob: (jobId: number, options?: Parameters<typeof customFetch>[1]) => Promise<PresentationOutlineJob>;
export declare const getGetPresentationOutlineJobQueryKey: (jobId: number) => readonly [`/api/presentations/ai/outline/jobs/${number}`];
export declare const getGetPresentationOutlineJobQueryOptions: <TData = Awaited<ReturnType<typeof getPresentationOutlineJob>>, TError = ErrorType<void>>(jobId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPresentationOutlineJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPresentationOutlineJob>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPresentationOutlineJobQueryResult = NonNullable<Awaited<ReturnType<typeof getPresentationOutlineJob>>>;
export type GetPresentationOutlineJobQueryError = ErrorType<void>;
/**
 * @summary Get an owned outline job
 */
export declare function useGetPresentationOutlineJob<TData = Awaited<ReturnType<typeof getPresentationOutlineJob>>, TError = ErrorType<void>>(jobId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPresentationOutlineJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetPresentationOutlineJobByKeyUrl: (key: string) => string;
/**
 * @summary Get an owned outline job by idempotency key
 */
export declare const getPresentationOutlineJobByKey: (key: string, options?: Parameters<typeof customFetch>[1]) => Promise<PresentationOutlineJob>;
export declare const getGetPresentationOutlineJobByKeyQueryKey: (key: string) => readonly [`/api/presentations/ai/outline/jobs/by-key/${string}`];
export declare const getGetPresentationOutlineJobByKeyQueryOptions: <TData = Awaited<ReturnType<typeof getPresentationOutlineJobByKey>>, TError = ErrorType<void>>(key: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPresentationOutlineJobByKey>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPresentationOutlineJobByKey>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPresentationOutlineJobByKeyQueryResult = NonNullable<Awaited<ReturnType<typeof getPresentationOutlineJobByKey>>>;
export type GetPresentationOutlineJobByKeyQueryError = ErrorType<void>;
/**
 * @summary Get an owned outline job by idempotency key
 */
export declare function useGetPresentationOutlineJobByKey<TData = Awaited<ReturnType<typeof getPresentationOutlineJobByKey>>, TError = ErrorType<void>>(key: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPresentationOutlineJobByKey>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getBuildPresentationFromDraftUrl: (draftId: number) => string;
/**
 * Per-slide materialization with skip-on-failure semantics. Failed
 * slides are reported in `skipped` so the teacher can author them
 * manually. Progress is persisted on the draft row after every
 * slide so a parallel poll on `GET /presentations/drafts/{id}`
 * can drive a real progress bar without SSE plumbing.
 * @summary Phase 1B — materialize an approved outline into a real deck
 */
export declare const buildPresentationFromDraft: (draftId: number, buildPresentationRequest?: BuildPresentationRequest, options?: Parameters<typeof customFetch>[1]) => Promise<BuildPresentationResponse>;
export declare const getBuildPresentationFromDraftMutationKey: () => readonly ["buildPresentationFromDraft"];
export declare const getBuildPresentationFromDraftMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof buildPresentationFromDraft>>, TError, BuildPresentationFromDraftMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof buildPresentationFromDraft>>, TError, BuildPresentationFromDraftMutationVariables, TContext>;
export type BuildPresentationFromDraftMutationResult = NonNullable<Awaited<ReturnType<typeof buildPresentationFromDraft>>>;
export type BuildPresentationFromDraftMutationBody = BodyType<BuildPresentationRequest> | undefined;
export type BuildPresentationFromDraftMutationError = ErrorType<ErrorResponse>;
export type BuildPresentationFromDraftMutationVariables = {
    draftId: number;
    data?: BodyType<BuildPresentationRequest>;
};
/**
* @summary Phase 1B — materialize an approved outline into a real deck
*/
export declare const useBuildPresentationFromDraft: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof buildPresentationFromDraft>>, TError, BuildPresentationFromDraftMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof buildPresentationFromDraft>>, TError, BuildPresentationFromDraftMutationVariables, TContext>;
export declare const getStreamPresentationBuildUrl: (draftId: number) => string;
/**
 * Server-Sent Events feed: emits `progress` events on each
 * polling tick and a terminal `done` event when the build
 * finishes (status `built` or `failed`). Consumed via the
 * browser's `EventSource`. Polling on the draft row remains
 * available as a fallback driver.
 * @summary Phase 1B — SSE stream of build progress
 */
export declare const streamPresentationBuild: (draftId: number, options?: Parameters<typeof customFetch>[1]) => Promise<string>;
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
export declare const getCancelPresentationBuildUrl: (draftId: number) => string;
/**
 * Sets an in-memory cancel flag the build loop checks once per
 * slide. Idempotent. Slides validated before the cancel arrived
 * are still persisted into the resulting deck.
 * @summary Phase 1B — request cancellation of an in-flight build
 */
export declare const cancelPresentationBuild: (draftId: number, options?: Parameters<typeof customFetch>[1]) => Promise<CancelBuildResponse>;
export declare const getCancelPresentationBuildMutationKey: () => readonly ["cancelPresentationBuild"];
export declare const getCancelPresentationBuildMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof cancelPresentationBuild>>, TError, CancelPresentationBuildMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof cancelPresentationBuild>>, TError, CancelPresentationBuildMutationVariables, TContext>;
export type CancelPresentationBuildMutationResult = NonNullable<Awaited<ReturnType<typeof cancelPresentationBuild>>>;
export type CancelPresentationBuildMutationError = ErrorType<ErrorResponse>;
export type CancelPresentationBuildMutationVariables = {
    draftId: number;
};
/**
* @summary Phase 1B — request cancellation of an in-flight build
*/
export declare const useCancelPresentationBuild: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof cancelPresentationBuild>>, TError, CancelPresentationBuildMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof cancelPresentationBuild>>, TError, CancelPresentationBuildMutationVariables, TContext>;
export declare const getListPresentationDraftsUrl: () => string;
/**
 * @summary List the current teacher's saved outline drafts
 */
export declare const listPresentationDrafts: (options?: Parameters<typeof customFetch>[1]) => Promise<PresentationDraft[]>;
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
export declare const getGetPresentationDraftUrl: (id: number) => string;
/**
 * @summary Read one draft (owner only)
 */
export declare const getPresentationDraft: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<PresentationDraft>;
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
export declare const getUpdatePresentationDraftUrl: (id: number) => string;
/**
 * @summary Update outline or status (owner only)
 */
export declare const updatePresentationDraft: (id: number, updatePresentationDraftBody: UpdatePresentationDraftBody, options?: Parameters<typeof customFetch>[1]) => Promise<PresentationDraft>;
export declare const getUpdatePresentationDraftMutationKey: () => readonly ["updatePresentationDraft"];
export declare const getUpdatePresentationDraftMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePresentationDraft>>, TError, UpdatePresentationDraftMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updatePresentationDraft>>, TError, UpdatePresentationDraftMutationVariables, TContext>;
export type UpdatePresentationDraftMutationResult = NonNullable<Awaited<ReturnType<typeof updatePresentationDraft>>>;
export type UpdatePresentationDraftMutationBody = BodyType<UpdatePresentationDraftBody>;
export type UpdatePresentationDraftMutationError = ErrorType<unknown>;
export type UpdatePresentationDraftMutationVariables = {
    id: number;
    data: BodyType<UpdatePresentationDraftBody>;
};
/**
* @summary Update outline or status (owner only)
*/
export declare const useUpdatePresentationDraft: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePresentationDraft>>, TError, UpdatePresentationDraftMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updatePresentationDraft>>, TError, UpdatePresentationDraftMutationVariables, TContext>;
export declare const getDeletePresentationDraftUrl: (id: number) => string;
/**
 * @summary Delete a draft (owner only)
 */
export declare const deletePresentationDraft: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getDeletePresentationDraftMutationKey: () => readonly ["deletePresentationDraft"];
export declare const getDeletePresentationDraftMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePresentationDraft>>, TError, DeletePresentationDraftMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deletePresentationDraft>>, TError, DeletePresentationDraftMutationVariables, TContext>;
export type DeletePresentationDraftMutationResult = NonNullable<Awaited<ReturnType<typeof deletePresentationDraft>>>;
export type DeletePresentationDraftMutationError = ErrorType<unknown>;
export type DeletePresentationDraftMutationVariables = {
    id: number;
};
/**
* @summary Delete a draft (owner only)
*/
export declare const useDeletePresentationDraft: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePresentationDraft>>, TError, DeletePresentationDraftMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deletePresentationDraft>>, TError, DeletePresentationDraftMutationVariables, TContext>;
export declare const getListAiVideoProjectsUrl: () => string;
/**
 * @summary List the authenticated teacher's AI video projects
 */
export declare const listAiVideoProjects: (options?: Parameters<typeof customFetch>[1]) => Promise<ListAiVideoProjects200>;
export declare const getListAiVideoProjectsQueryKey: () => readonly ["/api/ai-video/projects"];
export declare const getListAiVideoProjectsQueryOptions: <TData = Awaited<ReturnType<typeof listAiVideoProjects>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAiVideoProjects>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listAiVideoProjects>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListAiVideoProjectsQueryResult = NonNullable<Awaited<ReturnType<typeof listAiVideoProjects>>>;
export type ListAiVideoProjectsQueryError = ErrorType<void>;
/**
 * @summary List the authenticated teacher's AI video projects
 */
export declare function useListAiVideoProjects<TData = Awaited<ReturnType<typeof listAiVideoProjects>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAiVideoProjects>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUploadAiVideoSourceImageUrl: () => string;
/**
 * @summary Validate, normalize, and store a teacher-owned AI video source image
 */
export declare const uploadAiVideoSourceImage: (uploadAiVideoSourceImageBody: UploadAiVideoSourceImageBody, options?: Parameters<typeof customFetch>[1]) => Promise<UploadAiVideoSourceImage201>;
export declare const getUploadAiVideoSourceImageMutationKey: () => readonly ["uploadAiVideoSourceImage"];
export declare const getUploadAiVideoSourceImageMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof uploadAiVideoSourceImage>>, TError, UploadAiVideoSourceImageMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof uploadAiVideoSourceImage>>, TError, UploadAiVideoSourceImageMutationVariables, TContext>;
export type UploadAiVideoSourceImageMutationResult = NonNullable<Awaited<ReturnType<typeof uploadAiVideoSourceImage>>>;
export type UploadAiVideoSourceImageMutationBody = BodyType<UploadAiVideoSourceImageBody>;
export type UploadAiVideoSourceImageMutationError = ErrorType<void>;
export type UploadAiVideoSourceImageMutationVariables = {
    data: BodyType<UploadAiVideoSourceImageBody>;
};
/**
* @summary Validate, normalize, and store a teacher-owned AI video source image
*/
export declare const useUploadAiVideoSourceImage: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof uploadAiVideoSourceImage>>, TError, UploadAiVideoSourceImageMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof uploadAiVideoSourceImage>>, TError, UploadAiVideoSourceImageMutationVariables, TContext>;
export declare const getCreateAiVideoStoryboardUrl: () => string;
/**
 * @summary Generate and persist an idempotent educational storyboard
 */
export declare const createAiVideoStoryboard: (aiVideoBrief: AiVideoBrief, options?: Parameters<typeof customFetch>[1]) => Promise<AiVideoProject>;
export declare const getCreateAiVideoStoryboardMutationKey: () => readonly ["createAiVideoStoryboard"];
export declare const getCreateAiVideoStoryboardMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAiVideoStoryboard>>, TError, CreateAiVideoStoryboardMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createAiVideoStoryboard>>, TError, CreateAiVideoStoryboardMutationVariables, TContext>;
export type CreateAiVideoStoryboardMutationResult = NonNullable<Awaited<ReturnType<typeof createAiVideoStoryboard>>>;
export type CreateAiVideoStoryboardMutationBody = BodyType<AiVideoBrief>;
export type CreateAiVideoStoryboardMutationError = ErrorType<void>;
export type CreateAiVideoStoryboardMutationVariables = {
    data: BodyType<AiVideoBrief>;
};
/**
* @summary Generate and persist an idempotent educational storyboard
*/
export declare const useCreateAiVideoStoryboard: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAiVideoStoryboard>>, TError, CreateAiVideoStoryboardMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createAiVideoStoryboard>>, TError, CreateAiVideoStoryboardMutationVariables, TContext>;
export declare const getGetAiVideoProjectUrl: (id: number) => string;
/**
 * @summary Get an owned AI video project
 */
export declare const getAiVideoProject: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<AiVideoProject>;
export declare const getGetAiVideoProjectQueryKey: (id: number) => readonly [`/api/ai-video/projects/${number}`];
export declare const getGetAiVideoProjectQueryOptions: <TData = Awaited<ReturnType<typeof getAiVideoProject>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAiVideoProject>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAiVideoProject>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAiVideoProjectQueryResult = NonNullable<Awaited<ReturnType<typeof getAiVideoProject>>>;
export type GetAiVideoProjectQueryError = ErrorType<void>;
/**
 * @summary Get an owned AI video project
 */
export declare function useGetAiVideoProject<TData = Awaited<ReturnType<typeof getAiVideoProject>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAiVideoProject>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateAiVideoProjectUrl: (id: number) => string;
/**
 * @summary Edit title or storyboard while not rendering
 */
export declare const updateAiVideoProject: (id: number, updateAiVideoProjectBody: UpdateAiVideoProjectBody, options?: Parameters<typeof customFetch>[1]) => Promise<AiVideoProject>;
export declare const getUpdateAiVideoProjectMutationKey: () => readonly ["updateAiVideoProject"];
export declare const getUpdateAiVideoProjectMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateAiVideoProject>>, TError, UpdateAiVideoProjectMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateAiVideoProject>>, TError, UpdateAiVideoProjectMutationVariables, TContext>;
export type UpdateAiVideoProjectMutationResult = NonNullable<Awaited<ReturnType<typeof updateAiVideoProject>>>;
export type UpdateAiVideoProjectMutationBody = BodyType<UpdateAiVideoProjectBody>;
export type UpdateAiVideoProjectMutationError = ErrorType<void>;
export type UpdateAiVideoProjectMutationVariables = {
    id: number;
    data: BodyType<UpdateAiVideoProjectBody>;
};
/**
* @summary Edit title or storyboard while not rendering
*/
export declare const useUpdateAiVideoProject: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateAiVideoProject>>, TError, UpdateAiVideoProjectMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateAiVideoProject>>, TError, UpdateAiVideoProjectMutationVariables, TContext>;
export declare const getRenderAiVideoProjectUrl: (id: number) => string;
/**
 * @summary Start a persisted background MP4 render
 */
export declare const renderAiVideoProject: (id: number, aiVideoRenderBody: AiVideoRenderBody, options?: Parameters<typeof customFetch>[1]) => Promise<AiVideoProject>;
export declare const getRenderAiVideoProjectMutationKey: () => readonly ["renderAiVideoProject"];
export declare const getRenderAiVideoProjectMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof renderAiVideoProject>>, TError, RenderAiVideoProjectMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof renderAiVideoProject>>, TError, RenderAiVideoProjectMutationVariables, TContext>;
export type RenderAiVideoProjectMutationResult = NonNullable<Awaited<ReturnType<typeof renderAiVideoProject>>>;
export type RenderAiVideoProjectMutationBody = BodyType<AiVideoRenderBody>;
export type RenderAiVideoProjectMutationError = ErrorType<void>;
export type RenderAiVideoProjectMutationVariables = {
    id: number;
    data: BodyType<AiVideoRenderBody>;
};
/**
* @summary Start a persisted background MP4 render
*/
export declare const useRenderAiVideoProject: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof renderAiVideoProject>>, TError, RenderAiVideoProjectMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof renderAiVideoProject>>, TError, RenderAiVideoProjectMutationVariables, TContext>;
export declare const getQuoteAiVideoProjectRenderUrl: (id: number) => string;
/**
 * @summary Quote native-audio video provider cost before render approval
 */
export declare const quoteAiVideoProjectRender: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<AiVideoRenderQuote>;
export declare const getQuoteAiVideoProjectRenderMutationKey: () => readonly ["quoteAiVideoProjectRender"];
export declare const getQuoteAiVideoProjectRenderMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof quoteAiVideoProjectRender>>, TError, QuoteAiVideoProjectRenderMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof quoteAiVideoProjectRender>>, TError, QuoteAiVideoProjectRenderMutationVariables, TContext>;
export type QuoteAiVideoProjectRenderMutationResult = NonNullable<Awaited<ReturnType<typeof quoteAiVideoProjectRender>>>;
export type QuoteAiVideoProjectRenderMutationError = ErrorType<void>;
export type QuoteAiVideoProjectRenderMutationVariables = {
    id: number;
};
/**
* @summary Quote native-audio video provider cost before render approval
*/
export declare const useQuoteAiVideoProjectRender: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof quoteAiVideoProjectRender>>, TError, QuoteAiVideoProjectRenderMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof quoteAiVideoProjectRender>>, TError, QuoteAiVideoProjectRenderMutationVariables, TContext>;
export declare const getRetryAiVideoProjectRenderUrl: (id: number) => string;
/**
 * @summary Retry a failed background render
 */
export declare const retryAiVideoProjectRender: (id: number, aiVideoRenderBody: AiVideoRenderBody, options?: Parameters<typeof customFetch>[1]) => Promise<AiVideoProject>;
export declare const getRetryAiVideoProjectRenderMutationKey: () => readonly ["retryAiVideoProjectRender"];
export declare const getRetryAiVideoProjectRenderMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof retryAiVideoProjectRender>>, TError, RetryAiVideoProjectRenderMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof retryAiVideoProjectRender>>, TError, RetryAiVideoProjectRenderMutationVariables, TContext>;
export type RetryAiVideoProjectRenderMutationResult = NonNullable<Awaited<ReturnType<typeof retryAiVideoProjectRender>>>;
export type RetryAiVideoProjectRenderMutationBody = BodyType<AiVideoRenderBody>;
export type RetryAiVideoProjectRenderMutationError = ErrorType<void>;
export type RetryAiVideoProjectRenderMutationVariables = {
    id: number;
    data: BodyType<AiVideoRenderBody>;
};
/**
* @summary Retry a failed background render
*/
export declare const useRetryAiVideoProjectRender: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof retryAiVideoProjectRender>>, TError, RetryAiVideoProjectRenderMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof retryAiVideoProjectRender>>, TError, RetryAiVideoProjectRenderMutationVariables, TContext>;
export declare const getListTeacherScheduleUrl: () => string;
/**
 * @summary List the current teacher's weekly classes and appointments
 */
export declare const listTeacherSchedule: (options?: Parameters<typeof customFetch>[1]) => Promise<TeacherScheduleEntry[]>;
export declare const getListTeacherScheduleQueryKey: () => readonly ["/api/teacher/schedule"];
export declare const getListTeacherScheduleQueryOptions: <TData = Awaited<ReturnType<typeof listTeacherSchedule>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTeacherSchedule>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listTeacherSchedule>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListTeacherScheduleQueryResult = NonNullable<Awaited<ReturnType<typeof listTeacherSchedule>>>;
export type ListTeacherScheduleQueryError = ErrorType<void>;
/**
 * @summary List the current teacher's weekly classes and appointments
 */
export declare function useListTeacherSchedule<TData = Awaited<ReturnType<typeof listTeacherSchedule>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTeacherSchedule>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getDeleteTeacherScheduleUrl: () => string;
/**
 * @summary Delete every schedule entry owned by the current teacher
 */
export declare const deleteTeacherSchedule: (options?: Parameters<typeof customFetch>[1]) => Promise<TeacherScheduleDeleteResult>;
export declare const getDeleteTeacherScheduleMutationKey: () => readonly ["deleteTeacherSchedule"];
export declare const getDeleteTeacherScheduleMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteTeacherSchedule>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteTeacherSchedule>>, TError, void, TContext>;
export type DeleteTeacherScheduleMutationResult = NonNullable<Awaited<ReturnType<typeof deleteTeacherSchedule>>>;
export type DeleteTeacherScheduleMutationError = ErrorType<void>;
/**
* @summary Delete every schedule entry owned by the current teacher
*/
export declare const useDeleteTeacherSchedule: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteTeacherSchedule>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteTeacherSchedule>>, TError, void, TContext>;
export declare const getCreateTeacherScheduleEntryUrl: () => string;
/**
 * @summary Add a weekly class or one-time appointment
 */
export declare const createTeacherScheduleEntry: (teacherScheduleEntryInput: TeacherScheduleEntryInput, options?: Parameters<typeof customFetch>[1]) => Promise<TeacherScheduleEntry>;
export declare const getCreateTeacherScheduleEntryMutationKey: () => readonly ["createTeacherScheduleEntry"];
export declare const getCreateTeacherScheduleEntryMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createTeacherScheduleEntry>>, TError, CreateTeacherScheduleEntryMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createTeacherScheduleEntry>>, TError, CreateTeacherScheduleEntryMutationVariables, TContext>;
export type CreateTeacherScheduleEntryMutationResult = NonNullable<Awaited<ReturnType<typeof createTeacherScheduleEntry>>>;
export type CreateTeacherScheduleEntryMutationBody = BodyType<TeacherScheduleEntryInput>;
export type CreateTeacherScheduleEntryMutationError = ErrorType<void>;
export type CreateTeacherScheduleEntryMutationVariables = {
    data: BodyType<TeacherScheduleEntryInput>;
};
/**
* @summary Add a weekly class or one-time appointment
*/
export declare const useCreateTeacherScheduleEntry: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createTeacherScheduleEntry>>, TError, CreateTeacherScheduleEntryMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createTeacherScheduleEntry>>, TError, CreateTeacherScheduleEntryMutationVariables, TContext>;
export declare const getBulkCreateTeacherScheduleUrl: () => string;
/**
 * @summary Add several weekly classes for one or more days atomically
 */
export declare const bulkCreateTeacherSchedule: (teacherScheduleBulkInput: TeacherScheduleBulkInput, options?: Parameters<typeof customFetch>[1]) => Promise<TeacherScheduleEntry[]>;
export declare const getBulkCreateTeacherScheduleMutationKey: () => readonly ["bulkCreateTeacherSchedule"];
export declare const getBulkCreateTeacherScheduleMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof bulkCreateTeacherSchedule>>, TError, BulkCreateTeacherScheduleMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof bulkCreateTeacherSchedule>>, TError, BulkCreateTeacherScheduleMutationVariables, TContext>;
export type BulkCreateTeacherScheduleMutationResult = NonNullable<Awaited<ReturnType<typeof bulkCreateTeacherSchedule>>>;
export type BulkCreateTeacherScheduleMutationBody = BodyType<TeacherScheduleBulkInput>;
export type BulkCreateTeacherScheduleMutationError = ErrorType<void>;
export type BulkCreateTeacherScheduleMutationVariables = {
    data: BodyType<TeacherScheduleBulkInput>;
};
/**
* @summary Add several weekly classes for one or more days atomically
*/
export declare const useBulkCreateTeacherSchedule: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof bulkCreateTeacherSchedule>>, TError, BulkCreateTeacherScheduleMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof bulkCreateTeacherSchedule>>, TError, BulkCreateTeacherScheduleMutationVariables, TContext>;
export declare const getUpdateTeacherScheduleEntryUrl: (id: number) => string;
/**
 * @summary Update one of the current teacher's schedule entries
 */
export declare const updateTeacherScheduleEntry: (id: number, teacherScheduleEntryUpdate: TeacherScheduleEntryUpdate, options?: Parameters<typeof customFetch>[1]) => Promise<TeacherScheduleEntry>;
export declare const getUpdateTeacherScheduleEntryMutationKey: () => readonly ["updateTeacherScheduleEntry"];
export declare const getUpdateTeacherScheduleEntryMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTeacherScheduleEntry>>, TError, UpdateTeacherScheduleEntryMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateTeacherScheduleEntry>>, TError, UpdateTeacherScheduleEntryMutationVariables, TContext>;
export type UpdateTeacherScheduleEntryMutationResult = NonNullable<Awaited<ReturnType<typeof updateTeacherScheduleEntry>>>;
export type UpdateTeacherScheduleEntryMutationBody = BodyType<TeacherScheduleEntryUpdate>;
export type UpdateTeacherScheduleEntryMutationError = ErrorType<void>;
export type UpdateTeacherScheduleEntryMutationVariables = {
    id: number;
    data: BodyType<TeacherScheduleEntryUpdate>;
};
/**
* @summary Update one of the current teacher's schedule entries
*/
export declare const useUpdateTeacherScheduleEntry: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTeacherScheduleEntry>>, TError, UpdateTeacherScheduleEntryMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateTeacherScheduleEntry>>, TError, UpdateTeacherScheduleEntryMutationVariables, TContext>;
export declare const getDeleteTeacherScheduleEntryUrl: (id: number) => string;
/**
 * @summary Delete one of the current teacher's schedule entries
 */
export declare const deleteTeacherScheduleEntry: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getDeleteTeacherScheduleEntryMutationKey: () => readonly ["deleteTeacherScheduleEntry"];
export declare const getDeleteTeacherScheduleEntryMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteTeacherScheduleEntry>>, TError, DeleteTeacherScheduleEntryMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteTeacherScheduleEntry>>, TError, DeleteTeacherScheduleEntryMutationVariables, TContext>;
export type DeleteTeacherScheduleEntryMutationResult = NonNullable<Awaited<ReturnType<typeof deleteTeacherScheduleEntry>>>;
export type DeleteTeacherScheduleEntryMutationError = ErrorType<void>;
export type DeleteTeacherScheduleEntryMutationVariables = {
    id: number;
};
/**
* @summary Delete one of the current teacher's schedule entries
*/
export declare const useDeleteTeacherScheduleEntry: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteTeacherScheduleEntry>>, TError, DeleteTeacherScheduleEntryMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteTeacherScheduleEntry>>, TError, DeleteTeacherScheduleEntryMutationVariables, TContext>;
export declare const getListQuranSurahsUrl: () => string;
/**
 * @summary List canonical Quran surah metadata
 */
export declare const listQuranSurahs: (options?: Parameters<typeof customFetch>[1]) => Promise<QuranSurah[]>;
export declare const getListQuranSurahsQueryKey: () => readonly ["/api/quran/surahs"];
export declare const getListQuranSurahsQueryOptions: <TData = Awaited<ReturnType<typeof listQuranSurahs>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listQuranSurahs>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listQuranSurahs>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListQuranSurahsQueryResult = NonNullable<Awaited<ReturnType<typeof listQuranSurahs>>>;
export type ListQuranSurahsQueryError = ErrorType<unknown>;
/**
 * @summary List canonical Quran surah metadata
 */
export declare function useListQuranSurahs<TData = Awaited<ReturnType<typeof listQuranSurahs>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listQuranSurahs>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListQuranRecitersUrl: () => string;
/**
 * @summary List trusted Quran Foundation reciters and the current account preference
 */
export declare const listQuranReciters: (options?: Parameters<typeof customFetch>[1]) => Promise<QuranReciterCatalog>;
export declare const getListQuranRecitersQueryKey: () => readonly ["/api/quran/reciters"];
export declare const getListQuranRecitersQueryOptions: <TData = Awaited<ReturnType<typeof listQuranReciters>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listQuranReciters>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listQuranReciters>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListQuranRecitersQueryResult = NonNullable<Awaited<ReturnType<typeof listQuranReciters>>>;
export type ListQuranRecitersQueryError = ErrorType<void>;
/**
 * @summary List trusted Quran Foundation reciters and the current account preference
 */
export declare function useListQuranReciters<TData = Awaited<ReturnType<typeof listQuranReciters>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listQuranReciters>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateQuranAudioPreferenceUrl: () => string;
/**
 * @summary Save the current teacher or student account's preferred recitation
 */
export declare const updateQuranAudioPreference: (quranAudioPreferenceInput: QuranAudioPreferenceInput, options?: Parameters<typeof customFetch>[1]) => Promise<QuranAudioPreference>;
export declare const getUpdateQuranAudioPreferenceMutationKey: () => readonly ["updateQuranAudioPreference"];
export declare const getUpdateQuranAudioPreferenceMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateQuranAudioPreference>>, TError, UpdateQuranAudioPreferenceMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateQuranAudioPreference>>, TError, UpdateQuranAudioPreferenceMutationVariables, TContext>;
export type UpdateQuranAudioPreferenceMutationResult = NonNullable<Awaited<ReturnType<typeof updateQuranAudioPreference>>>;
export type UpdateQuranAudioPreferenceMutationBody = BodyType<QuranAudioPreferenceInput>;
export type UpdateQuranAudioPreferenceMutationError = ErrorType<void>;
export type UpdateQuranAudioPreferenceMutationVariables = {
    data: BodyType<QuranAudioPreferenceInput>;
};
/**
* @summary Save the current teacher or student account's preferred recitation
*/
export declare const useUpdateQuranAudioPreference: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateQuranAudioPreference>>, TError, UpdateQuranAudioPreferenceMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateQuranAudioPreference>>, TError, UpdateQuranAudioPreferenceMutationVariables, TContext>;
export declare const getGetQuranSurahContentUrl: (surahNumber: number) => string;
/**
 * @summary Get official Uthmani Quran text for one surah
 */
export declare const getQuranSurahContent: (surahNumber: number, options?: Parameters<typeof customFetch>[1]) => Promise<QuranSurahContent>;
export declare const getGetQuranSurahContentQueryKey: (surahNumber: number) => readonly [`/api/quran/content/${number}`];
export declare const getGetQuranSurahContentQueryOptions: <TData = Awaited<ReturnType<typeof getQuranSurahContent>>, TError = ErrorType<void>>(surahNumber: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranSurahContent>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getQuranSurahContent>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetQuranSurahContentQueryResult = NonNullable<Awaited<ReturnType<typeof getQuranSurahContent>>>;
export type GetQuranSurahContentQueryError = ErrorType<void>;
/**
 * @summary Get official Uthmani Quran text for one surah
 */
export declare function useGetQuranSurahContent<TData = Awaited<ReturnType<typeof getQuranSurahContent>>, TError = ErrorType<void>>(surahNumber: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranSurahContent>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getTranscribeQuranRecitationPartialUrl: () => string;
/**
 * @summary Transcribe a short authenticated Quran recitation audio chunk
 */
export declare const transcribeQuranRecitationPartial: (transcribeQuranRecitationPartialBody: TranscribeQuranRecitationPartialBody, options?: Parameters<typeof customFetch>[1]) => Promise<QuranRecitationPartialResponse>;
export declare const getTranscribeQuranRecitationPartialMutationKey: () => readonly ["transcribeQuranRecitationPartial"];
export declare const getTranscribeQuranRecitationPartialMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof transcribeQuranRecitationPartial>>, TError, TranscribeQuranRecitationPartialMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof transcribeQuranRecitationPartial>>, TError, TranscribeQuranRecitationPartialMutationVariables, TContext>;
export type TranscribeQuranRecitationPartialMutationResult = NonNullable<Awaited<ReturnType<typeof transcribeQuranRecitationPartial>>>;
export type TranscribeQuranRecitationPartialMutationBody = BodyType<TranscribeQuranRecitationPartialBody>;
export type TranscribeQuranRecitationPartialMutationError = ErrorType<void>;
export type TranscribeQuranRecitationPartialMutationVariables = {
    data: BodyType<TranscribeQuranRecitationPartialBody>;
};
/**
* @summary Transcribe a short authenticated Quran recitation audio chunk
*/
export declare const useTranscribeQuranRecitationPartial: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof transcribeQuranRecitationPartial>>, TError, TranscribeQuranRecitationPartialMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof transcribeQuranRecitationPartial>>, TError, TranscribeQuranRecitationPartialMutationVariables, TContext>;
export declare const getGetQuranAyahAudioUrl: (recitationId: number, surahNumber: number, ayahNumber: number) => string;
/**
 * @summary Redirect to the official audio for one ayah
 */
export declare const getQuranAyahAudio: (recitationId: number, surahNumber: number, ayahNumber: number, options?: Parameters<typeof customFetch>[1]) => Promise<unknown>;
export declare const getGetQuranAyahAudioQueryKey: (recitationId: number, surahNumber: number, ayahNumber: number) => readonly [`/api/quran/audio/${number}/${number}/${number}`];
export declare const getGetQuranAyahAudioQueryOptions: <TData = Awaited<ReturnType<typeof getQuranAyahAudio>>, TError = ErrorType<void>>(recitationId: number, surahNumber: number, ayahNumber: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranAyahAudio>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getQuranAyahAudio>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetQuranAyahAudioQueryResult = NonNullable<Awaited<ReturnType<typeof getQuranAyahAudio>>>;
export type GetQuranAyahAudioQueryError = ErrorType<void>;
/**
 * @summary Redirect to the official audio for one ayah
 */
export declare function useGetQuranAyahAudio<TData = Awaited<ReturnType<typeof getQuranAyahAudio>>, TError = ErrorType<void>>(recitationId: number, surahNumber: number, ayahNumber: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranAyahAudio>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetQuranWordAudioUrl: (surahNumber: number, ayahNumber: number, wordPosition: number) => string;
/**
 * @summary Redirect to the official Quran Foundation audio for one word
 */
export declare const getQuranWordAudio: (surahNumber: number, ayahNumber: number, wordPosition: number, options?: Parameters<typeof customFetch>[1]) => Promise<unknown>;
export declare const getGetQuranWordAudioQueryKey: (surahNumber: number, ayahNumber: number, wordPosition: number) => readonly [`/api/quran/audio/word/${number}/${number}/${number}`];
export declare const getGetQuranWordAudioQueryOptions: <TData = Awaited<ReturnType<typeof getQuranWordAudio>>, TError = ErrorType<void>>(surahNumber: number, ayahNumber: number, wordPosition: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranWordAudio>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getQuranWordAudio>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetQuranWordAudioQueryResult = NonNullable<Awaited<ReturnType<typeof getQuranWordAudio>>>;
export type GetQuranWordAudioQueryError = ErrorType<void>;
/**
 * @summary Redirect to the official Quran Foundation audio for one word
 */
export declare function useGetQuranWordAudio<TData = Awaited<ReturnType<typeof getQuranWordAudio>>, TError = ErrorType<void>>(surahNumber: number, ayahNumber: number, wordPosition: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranWordAudio>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetQuranAyahTimingsUrl: (recitationId: number, surahNumber: number, ayahNumber: number) => string;
/**
 * @summary Get verified word timings for one ayah
 */
export declare const getQuranAyahTimings: (recitationId: number, surahNumber: number, ayahNumber: number, options?: Parameters<typeof customFetch>[1]) => Promise<QuranAyahTimings>;
export declare const getGetQuranAyahTimingsQueryKey: (recitationId: number, surahNumber: number, ayahNumber: number) => readonly [`/api/quran/audio/${number}/${number}/${number}/timings`];
export declare const getGetQuranAyahTimingsQueryOptions: <TData = Awaited<ReturnType<typeof getQuranAyahTimings>>, TError = ErrorType<void>>(recitationId: number, surahNumber: number, ayahNumber: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranAyahTimings>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getQuranAyahTimings>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetQuranAyahTimingsQueryResult = NonNullable<Awaited<ReturnType<typeof getQuranAyahTimings>>>;
export type GetQuranAyahTimingsQueryError = ErrorType<void>;
/**
 * @summary Get verified word timings for one ayah
 */
export declare function useGetQuranAyahTimings<TData = Awaited<ReturnType<typeof getQuranAyahTimings>>, TError = ErrorType<void>>(recitationId: number, surahNumber: number, ayahNumber: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranAyahTimings>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetQuranMadaniPageUrl: (pageNumber: number) => string;
/**
 * @summary Get one official QCF V2 Madani Mushaf page
 */
export declare const getQuranMadaniPage: (pageNumber: number, options?: Parameters<typeof customFetch>[1]) => Promise<QuranMadaniPage>;
export declare const getGetQuranMadaniPageQueryKey: (pageNumber: number) => readonly [`/api/quran/madani/pages/${number}`];
export declare const getGetQuranMadaniPageQueryOptions: <TData = Awaited<ReturnType<typeof getQuranMadaniPage>>, TError = ErrorType<void>>(pageNumber: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranMadaniPage>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getQuranMadaniPage>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetQuranMadaniPageQueryResult = NonNullable<Awaited<ReturnType<typeof getQuranMadaniPage>>>;
export type GetQuranMadaniPageQueryError = ErrorType<void>;
/**
 * @summary Get one official QCF V2 Madani Mushaf page
 */
export declare function useGetQuranMadaniPage<TData = Awaited<ReturnType<typeof getQuranMadaniPage>>, TError = ErrorType<void>>(pageNumber: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranMadaniPage>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetQuranOfflineContentUrl: (group: "mushafs" | "tafsirs", action: "sync" | "snapshot", params?: GetQuranOfflineContentParams) => string;
/**
 * @summary Sync the fixed public Mushaf or Muyassar tafsir edition to this reader
 */
export declare const getQuranOfflineContent: (group: "mushafs" | "tafsirs", action: "sync" | "snapshot", params?: GetQuranOfflineContentParams, options?: Parameters<typeof customFetch>[1]) => Promise<GetQuranOfflineContent200>;
export declare const getGetQuranOfflineContentQueryKey: (group: "mushafs" | "tafsirs", action: "sync" | "snapshot", params?: GetQuranOfflineContentParams) => readonly ["/api/quran/offline/mushafs/sync" | "/api/quran/offline/mushafs/snapshot" | "/api/quran/offline/tafsirs/sync" | "/api/quran/offline/tafsirs/snapshot", ...GetQuranOfflineContentParams[]];
export declare const getGetQuranOfflineContentQueryOptions: <TData = Awaited<ReturnType<typeof getQuranOfflineContent>>, TError = ErrorType<void>>(group: "mushafs" | "tafsirs", action: "sync" | "snapshot", params?: GetQuranOfflineContentParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranOfflineContent>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getQuranOfflineContent>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetQuranOfflineContentQueryResult = NonNullable<Awaited<ReturnType<typeof getQuranOfflineContent>>>;
export type GetQuranOfflineContentQueryError = ErrorType<void>;
/**
 * @summary Sync the fixed public Mushaf or Muyassar tafsir edition to this reader
 */
export declare function useGetQuranOfflineContent<TData = Awaited<ReturnType<typeof getQuranOfflineContent>>, TError = ErrorType<void>>(group: 'mushafs' | 'tafsirs', action: 'sync' | 'snapshot', params?: GetQuranOfflineContentParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranOfflineContent>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetQuranWordTajweedUrl: (surahNumber: number, ayahNumber: number, wordPosition: number) => string;
/**
 * @summary Get verified Tajweed rules for one word, independent of color font mode
 */
export declare const getQuranWordTajweed: (surahNumber: number, ayahNumber: number, wordPosition: number, options?: Parameters<typeof customFetch>[1]) => Promise<QuranWordTajweed>;
export declare const getGetQuranWordTajweedQueryKey: (surahNumber: number, ayahNumber: number, wordPosition: number) => readonly [`/api/quran/tajweed/word/${number}/${number}/${number}`];
export declare const getGetQuranWordTajweedQueryOptions: <TData = Awaited<ReturnType<typeof getQuranWordTajweed>>, TError = ErrorType<void>>(surahNumber: number, ayahNumber: number, wordPosition: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranWordTajweed>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getQuranWordTajweed>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetQuranWordTajweedQueryResult = NonNullable<Awaited<ReturnType<typeof getQuranWordTajweed>>>;
export type GetQuranWordTajweedQueryError = ErrorType<void>;
/**
 * @summary Get verified Tajweed rules for one word, independent of color font mode
 */
export declare function useGetQuranWordTajweed<TData = Awaited<ReturnType<typeof getQuranWordTajweed>>, TError = ErrorType<void>>(surahNumber: number, ayahNumber: number, wordPosition: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranWordTajweed>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetQuranAyahEducationUrl: (surahNumber: number, ayahNumber: number, params?: GetQuranAyahEducationParams) => string;
/**
 * @summary Get sourced Arabic word context and tafsir for one ayah
 */
export declare const getQuranAyahEducation: (surahNumber: number, ayahNumber: number, params?: GetQuranAyahEducationParams, options?: Parameters<typeof customFetch>[1]) => Promise<QuranAyahEducation>;
export declare const getGetQuranAyahEducationQueryKey: (surahNumber: number, ayahNumber: number, params?: GetQuranAyahEducationParams) => readonly [`/api/quran/education/${number}/${number}`, ...GetQuranAyahEducationParams[]];
export declare const getGetQuranAyahEducationQueryOptions: <TData = Awaited<ReturnType<typeof getQuranAyahEducation>>, TError = ErrorType<void>>(surahNumber: number, ayahNumber: number, params?: GetQuranAyahEducationParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranAyahEducation>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getQuranAyahEducation>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetQuranAyahEducationQueryResult = NonNullable<Awaited<ReturnType<typeof getQuranAyahEducation>>>;
export type GetQuranAyahEducationQueryError = ErrorType<void>;
/**
 * @summary Get sourced Arabic word context and tafsir for one ayah
 */
export declare function useGetQuranAyahEducation<TData = Awaited<ReturnType<typeof getQuranAyahEducation>>, TError = ErrorType<void>>(surahNumber: number, ayahNumber: number, params?: GetQuranAyahEducationParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranAyahEducation>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListQuranCirclesUrl: () => string;
/**
 * @summary List the current teacher's Quran circles and members
 */
export declare const listQuranCircles: (options?: Parameters<typeof customFetch>[1]) => Promise<QuranCircle[]>;
export declare const getListQuranCirclesQueryKey: () => readonly ["/api/quran/circles"];
export declare const getListQuranCirclesQueryOptions: <TData = Awaited<ReturnType<typeof listQuranCircles>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listQuranCircles>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listQuranCircles>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListQuranCirclesQueryResult = NonNullable<Awaited<ReturnType<typeof listQuranCircles>>>;
export type ListQuranCirclesQueryError = ErrorType<unknown>;
/**
 * @summary List the current teacher's Quran circles and members
 */
export declare function useListQuranCircles<TData = Awaited<ReturnType<typeof listQuranCircles>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listQuranCircles>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateQuranCircleUrl: () => string;
/**
 * @summary Create a Quran circle
 */
export declare const createQuranCircle: (quranCircleInput: QuranCircleInput, options?: Parameters<typeof customFetch>[1]) => Promise<QuranCircle>;
export declare const getCreateQuranCircleMutationKey: () => readonly ["createQuranCircle"];
export declare const getCreateQuranCircleMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createQuranCircle>>, TError, CreateQuranCircleMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createQuranCircle>>, TError, CreateQuranCircleMutationVariables, TContext>;
export type CreateQuranCircleMutationResult = NonNullable<Awaited<ReturnType<typeof createQuranCircle>>>;
export type CreateQuranCircleMutationBody = BodyType<QuranCircleInput>;
export type CreateQuranCircleMutationError = ErrorType<void>;
export type CreateQuranCircleMutationVariables = {
    data: BodyType<QuranCircleInput>;
};
/**
* @summary Create a Quran circle
*/
export declare const useCreateQuranCircle: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createQuranCircle>>, TError, CreateQuranCircleMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createQuranCircle>>, TError, CreateQuranCircleMutationVariables, TContext>;
export declare const getGetQuranCircleUrl: (id: number) => string;
/**
 * @summary Get a Quran circle with members
 */
export declare const getQuranCircle: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<QuranCircle>;
export declare const getGetQuranCircleQueryKey: (id: number) => readonly [`/api/quran/circles/${number}`];
export declare const getGetQuranCircleQueryOptions: <TData = Awaited<ReturnType<typeof getQuranCircle>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranCircle>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getQuranCircle>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetQuranCircleQueryResult = NonNullable<Awaited<ReturnType<typeof getQuranCircle>>>;
export type GetQuranCircleQueryError = ErrorType<void>;
/**
 * @summary Get a Quran circle with members
 */
export declare function useGetQuranCircle<TData = Awaited<ReturnType<typeof getQuranCircle>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranCircle>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateQuranCircleUrl: (id: number) => string;
/**
 * @summary Update a Quran circle and its selected members
 */
export declare const updateQuranCircle: (id: number, quranCircleUpdate: QuranCircleUpdate, options?: Parameters<typeof customFetch>[1]) => Promise<QuranCircle>;
export declare const getUpdateQuranCircleMutationKey: () => readonly ["updateQuranCircle"];
export declare const getUpdateQuranCircleMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateQuranCircle>>, TError, UpdateQuranCircleMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateQuranCircle>>, TError, UpdateQuranCircleMutationVariables, TContext>;
export type UpdateQuranCircleMutationResult = NonNullable<Awaited<ReturnType<typeof updateQuranCircle>>>;
export type UpdateQuranCircleMutationBody = BodyType<QuranCircleUpdate>;
export type UpdateQuranCircleMutationError = ErrorType<void>;
export type UpdateQuranCircleMutationVariables = {
    id: number;
    data: BodyType<QuranCircleUpdate>;
};
/**
* @summary Update a Quran circle and its selected members
*/
export declare const useUpdateQuranCircle: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateQuranCircle>>, TError, UpdateQuranCircleMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateQuranCircle>>, TError, UpdateQuranCircleMutationVariables, TContext>;
export declare const getListQuranStudentsUrl: () => string;
/**
 * @summary List the current teacher's roster students for Quran
 */
export declare const listQuranStudents: (options?: Parameters<typeof customFetch>[1]) => Promise<QuranStudent[]>;
export declare const getListQuranStudentsQueryKey: () => readonly ["/api/quran/students"];
export declare const getListQuranStudentsQueryOptions: <TData = Awaited<ReturnType<typeof listQuranStudents>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listQuranStudents>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listQuranStudents>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListQuranStudentsQueryResult = NonNullable<Awaited<ReturnType<typeof listQuranStudents>>>;
export type ListQuranStudentsQueryError = ErrorType<unknown>;
/**
 * @summary List the current teacher's roster students for Quran
 */
export declare function useListQuranStudents<TData = Awaited<ReturnType<typeof listQuranStudents>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listQuranStudents>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetQuranStudentSummaryUrl: (studentId: number) => string;
/**
 * @summary Get a Quran student profile and progress summary
 */
export declare const getQuranStudentSummary: (studentId: number, options?: Parameters<typeof customFetch>[1]) => Promise<QuranStudentSummary>;
export declare const getGetQuranStudentSummaryQueryKey: (studentId: number) => readonly [`/api/quran/students/${number}`];
export declare const getGetQuranStudentSummaryQueryOptions: <TData = Awaited<ReturnType<typeof getQuranStudentSummary>>, TError = ErrorType<void>>(studentId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranStudentSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getQuranStudentSummary>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetQuranStudentSummaryQueryResult = NonNullable<Awaited<ReturnType<typeof getQuranStudentSummary>>>;
export type GetQuranStudentSummaryQueryError = ErrorType<void>;
/**
 * @summary Get a Quran student profile and progress summary
 */
export declare function useGetQuranStudentSummary<TData = Awaited<ReturnType<typeof getQuranStudentSummary>>, TError = ErrorType<void>>(studentId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranStudentSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateQuranStudentProfileUrl: (studentId: number) => string;
/**
 * @summary Update a Quran student's current position and progress
 */
export declare const updateQuranStudentProfile: (studentId: number, quranProfileUpdate: QuranProfileUpdate, options?: Parameters<typeof customFetch>[1]) => Promise<QuranStudentProfile>;
export declare const getUpdateQuranStudentProfileMutationKey: () => readonly ["updateQuranStudentProfile"];
export declare const getUpdateQuranStudentProfileMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateQuranStudentProfile>>, TError, UpdateQuranStudentProfileMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateQuranStudentProfile>>, TError, UpdateQuranStudentProfileMutationVariables, TContext>;
export type UpdateQuranStudentProfileMutationResult = NonNullable<Awaited<ReturnType<typeof updateQuranStudentProfile>>>;
export type UpdateQuranStudentProfileMutationBody = BodyType<QuranProfileUpdate>;
export type UpdateQuranStudentProfileMutationError = ErrorType<void>;
export type UpdateQuranStudentProfileMutationVariables = {
    studentId: number;
    data: BodyType<QuranProfileUpdate>;
};
/**
* @summary Update a Quran student's current position and progress
*/
export declare const useUpdateQuranStudentProfile: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateQuranStudentProfile>>, TError, UpdateQuranStudentProfileMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateQuranStudentProfile>>, TError, UpdateQuranStudentProfileMutationVariables, TContext>;
export declare const getListQuranStudentWardsUrl: (studentId: number) => string;
/**
 * @summary List wards for one Quran student
 */
export declare const listQuranStudentWards: (studentId: number, options?: Parameters<typeof customFetch>[1]) => Promise<QuranWard[]>;
export declare const getListQuranStudentWardsQueryKey: (studentId: number) => readonly [`/api/quran/students/${number}/wards`];
export declare const getListQuranStudentWardsQueryOptions: <TData = Awaited<ReturnType<typeof listQuranStudentWards>>, TError = ErrorType<unknown>>(studentId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listQuranStudentWards>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listQuranStudentWards>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListQuranStudentWardsQueryResult = NonNullable<Awaited<ReturnType<typeof listQuranStudentWards>>>;
export type ListQuranStudentWardsQueryError = ErrorType<unknown>;
/**
 * @summary List wards for one Quran student
 */
export declare function useListQuranStudentWards<TData = Awaited<ReturnType<typeof listQuranStudentWards>>, TError = ErrorType<unknown>>(studentId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listQuranStudentWards>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListMyQuranWardsUrl: () => string;
/**
 * @summary List Quran wards assigned to the signed-in student
 */
export declare const listMyQuranWards: (options?: Parameters<typeof customFetch>[1]) => Promise<QuranWard[]>;
export declare const getListMyQuranWardsQueryKey: () => readonly ["/api/quran/me/wards"];
export declare const getListMyQuranWardsQueryOptions: <TData = Awaited<ReturnType<typeof listMyQuranWards>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMyQuranWards>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listMyQuranWards>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListMyQuranWardsQueryResult = NonNullable<Awaited<ReturnType<typeof listMyQuranWards>>>;
export type ListMyQuranWardsQueryError = ErrorType<void>;
/**
 * @summary List Quran wards assigned to the signed-in student
 */
export declare function useListMyQuranWards<TData = Awaited<ReturnType<typeof listMyQuranWards>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMyQuranWards>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetQuranJourneyUrl: () => string;
/**
 * Returns only Quran records owned by the signed-in student account. Recitations are canonical when a reviewed submission also exists.
 * @summary Get the signed-in student's personal Quran journey
 */
export declare const getQuranJourney: (options?: Parameters<typeof customFetch>[1]) => Promise<QuranJourney>;
export declare const getGetQuranJourneyQueryKey: () => readonly ["/api/quran/me/journey"];
export declare const getGetQuranJourneyQueryOptions: <TData = Awaited<ReturnType<typeof getQuranJourney>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranJourney>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getQuranJourney>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetQuranJourneyQueryResult = NonNullable<Awaited<ReturnType<typeof getQuranJourney>>>;
export type GetQuranJourneyQueryError = ErrorType<void>;
/**
 * @summary Get the signed-in student's personal Quran journey
 */
export declare function useGetQuranJourney<TData = Awaited<ReturnType<typeof getQuranJourney>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranJourney>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateMyQuranIndependentPositionUrl: () => string;
/**
 * @summary Save the signed-in student's latest independent Quran positions
 */
export declare const updateMyQuranIndependentPosition: (quranIndependentPositionInput: QuranIndependentPositionInput, options?: Parameters<typeof customFetch>[1]) => Promise<QuranIndependentPosition>;
export declare const getUpdateMyQuranIndependentPositionMutationKey: () => readonly ["updateMyQuranIndependentPosition"];
export declare const getUpdateMyQuranIndependentPositionMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateMyQuranIndependentPosition>>, TError, UpdateMyQuranIndependentPositionMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateMyQuranIndependentPosition>>, TError, UpdateMyQuranIndependentPositionMutationVariables, TContext>;
export type UpdateMyQuranIndependentPositionMutationResult = NonNullable<Awaited<ReturnType<typeof updateMyQuranIndependentPosition>>>;
export type UpdateMyQuranIndependentPositionMutationBody = BodyType<QuranIndependentPositionInput>;
export type UpdateMyQuranIndependentPositionMutationError = ErrorType<void>;
export type UpdateMyQuranIndependentPositionMutationVariables = {
    data: BodyType<QuranIndependentPositionInput>;
};
/**
* @summary Save the signed-in student's latest independent Quran positions
*/
export declare const useUpdateMyQuranIndependentPosition: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateMyQuranIndependentPosition>>, TError, UpdateMyQuranIndependentPositionMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateMyQuranIndependentPosition>>, TError, UpdateMyQuranIndependentPositionMutationVariables, TContext>;
export declare const getRecordMyQuranIndependentSessionUrl: () => string;
/**
 * @summary Record an explicitly completed independent Quran practice session
 */
export declare const recordMyQuranIndependentSession: (quranIndependentSessionInput: QuranIndependentSessionInput, options?: Parameters<typeof customFetch>[1]) => Promise<QuranIndependentSession>;
export declare const getRecordMyQuranIndependentSessionMutationKey: () => readonly ["recordMyQuranIndependentSession"];
export declare const getRecordMyQuranIndependentSessionMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof recordMyQuranIndependentSession>>, TError, RecordMyQuranIndependentSessionMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof recordMyQuranIndependentSession>>, TError, RecordMyQuranIndependentSessionMutationVariables, TContext>;
export type RecordMyQuranIndependentSessionMutationResult = NonNullable<Awaited<ReturnType<typeof recordMyQuranIndependentSession>>>;
export type RecordMyQuranIndependentSessionMutationBody = BodyType<QuranIndependentSessionInput>;
export type RecordMyQuranIndependentSessionMutationError = ErrorType<void>;
export type RecordMyQuranIndependentSessionMutationVariables = {
    data: BodyType<QuranIndependentSessionInput>;
};
/**
* @summary Record an explicitly completed independent Quran practice session
*/
export declare const useRecordMyQuranIndependentSession: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof recordMyQuranIndependentSession>>, TError, RecordMyQuranIndependentSessionMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof recordMyQuranIndependentSession>>, TError, RecordMyQuranIndependentSessionMutationVariables, TContext>;
export declare const getGetMyQuranWardUrl: (id: number) => string;
/**
 * @summary Get one Quran ward owned by the signed-in student
 */
export declare const getMyQuranWard: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<QuranWard>;
export declare const getGetMyQuranWardQueryKey: (id: number) => readonly [`/api/quran/me/wards/${number}`];
export declare const getGetMyQuranWardQueryOptions: <TData = Awaited<ReturnType<typeof getMyQuranWard>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMyQuranWard>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMyQuranWard>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMyQuranWardQueryResult = NonNullable<Awaited<ReturnType<typeof getMyQuranWard>>>;
export type GetMyQuranWardQueryError = ErrorType<void>;
/**
 * @summary Get one Quran ward owned by the signed-in student
 */
export declare function useGetMyQuranWard<TData = Awaited<ReturnType<typeof getMyQuranWard>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMyQuranWard>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getAssignQuranStudentTaskUrl: (studentId: number) => string;
/**
 * @summary Assign multiple memorization and review ranges to one student
 */
export declare const assignQuranStudentTask: (studentId: number, quranCircleTaskInput: QuranCircleTaskInput, options?: Parameters<typeof customFetch>[1]) => Promise<QuranWard[]>;
export declare const getAssignQuranStudentTaskMutationKey: () => readonly ["assignQuranStudentTask"];
export declare const getAssignQuranStudentTaskMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof assignQuranStudentTask>>, TError, AssignQuranStudentTaskMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof assignQuranStudentTask>>, TError, AssignQuranStudentTaskMutationVariables, TContext>;
export type AssignQuranStudentTaskMutationResult = NonNullable<Awaited<ReturnType<typeof assignQuranStudentTask>>>;
export type AssignQuranStudentTaskMutationBody = BodyType<QuranCircleTaskInput>;
export type AssignQuranStudentTaskMutationError = ErrorType<void>;
export type AssignQuranStudentTaskMutationVariables = {
    studentId: number;
    data: BodyType<QuranCircleTaskInput>;
};
/**
* @summary Assign multiple memorization and review ranges to one student
*/
export declare const useAssignQuranStudentTask: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof assignQuranStudentTask>>, TError, AssignQuranStudentTaskMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof assignQuranStudentTask>>, TError, AssignQuranStudentTaskMutationVariables, TContext>;
export declare const getCreateQuranWardUrl: () => string;
/**
 * @summary Assign a Quran ward to a roster student
 */
export declare const createQuranWard: (quranWardInput: QuranWardInput, options?: Parameters<typeof customFetch>[1]) => Promise<QuranWard>;
export declare const getCreateQuranWardMutationKey: () => readonly ["createQuranWard"];
export declare const getCreateQuranWardMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createQuranWard>>, TError, CreateQuranWardMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createQuranWard>>, TError, CreateQuranWardMutationVariables, TContext>;
export type CreateQuranWardMutationResult = NonNullable<Awaited<ReturnType<typeof createQuranWard>>>;
export type CreateQuranWardMutationBody = BodyType<QuranWardInput>;
export type CreateQuranWardMutationError = ErrorType<void>;
export type CreateQuranWardMutationVariables = {
    data: BodyType<QuranWardInput>;
};
/**
* @summary Assign a Quran ward to a roster student
*/
export declare const useCreateQuranWard: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createQuranWard>>, TError, CreateQuranWardMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createQuranWard>>, TError, CreateQuranWardMutationVariables, TContext>;
export declare const getAssignQuranCircleTaskUrl: (id: number) => string;
/**
 * @summary Assign memorization and review to every member of a Quran circle
 */
export declare const assignQuranCircleTask: (id: number, quranCircleTaskInput: QuranCircleTaskInput, options?: Parameters<typeof customFetch>[1]) => Promise<QuranWard[]>;
export declare const getAssignQuranCircleTaskMutationKey: () => readonly ["assignQuranCircleTask"];
export declare const getAssignQuranCircleTaskMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof assignQuranCircleTask>>, TError, AssignQuranCircleTaskMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof assignQuranCircleTask>>, TError, AssignQuranCircleTaskMutationVariables, TContext>;
export type AssignQuranCircleTaskMutationResult = NonNullable<Awaited<ReturnType<typeof assignQuranCircleTask>>>;
export type AssignQuranCircleTaskMutationBody = BodyType<QuranCircleTaskInput>;
export type AssignQuranCircleTaskMutationError = ErrorType<void>;
export type AssignQuranCircleTaskMutationVariables = {
    id: number;
    data: BodyType<QuranCircleTaskInput>;
};
/**
* @summary Assign memorization and review to every member of a Quran circle
*/
export declare const useAssignQuranCircleTask: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof assignQuranCircleTask>>, TError, AssignQuranCircleTaskMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof assignQuranCircleTask>>, TError, AssignQuranCircleTaskMutationVariables, TContext>;
export declare const getUpdateQuranWardUrl: (id: number) => string;
/**
 * @summary Update a Quran ward
 */
export declare const updateQuranWard: (id: number, quranWardUpdate: QuranWardUpdate, options?: Parameters<typeof customFetch>[1]) => Promise<QuranWard>;
export declare const getUpdateQuranWardMutationKey: () => readonly ["updateQuranWard"];
export declare const getUpdateQuranWardMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateQuranWard>>, TError, UpdateQuranWardMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateQuranWard>>, TError, UpdateQuranWardMutationVariables, TContext>;
export type UpdateQuranWardMutationResult = NonNullable<Awaited<ReturnType<typeof updateQuranWard>>>;
export type UpdateQuranWardMutationBody = BodyType<QuranWardUpdate>;
export type UpdateQuranWardMutationError = ErrorType<void>;
export type UpdateQuranWardMutationVariables = {
    id: number;
    data: BodyType<QuranWardUpdate>;
};
/**
* @summary Update a Quran ward
*/
export declare const useUpdateQuranWard: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateQuranWard>>, TError, UpdateQuranWardMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateQuranWard>>, TError, UpdateQuranWardMutationVariables, TContext>;
export declare const getListQuranRecitationsUrl: (id: number) => string;
/**
 * @summary List recitation records for a ward
 */
export declare const listQuranRecitations: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<QuranRecitation[]>;
export declare const getListQuranRecitationsQueryKey: (id: number) => readonly [`/api/quran/wards/${number}/recitations`];
export declare const getListQuranRecitationsQueryOptions: <TData = Awaited<ReturnType<typeof listQuranRecitations>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listQuranRecitations>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listQuranRecitations>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListQuranRecitationsQueryResult = NonNullable<Awaited<ReturnType<typeof listQuranRecitations>>>;
export type ListQuranRecitationsQueryError = ErrorType<unknown>;
/**
 * @summary List recitation records for a ward
 */
export declare function useListQuranRecitations<TData = Awaited<ReturnType<typeof listQuranRecitations>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listQuranRecitations>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateQuranRecitationUrl: (id: number) => string;
/**
 * @summary Save a recitation and update progress transactionally
 */
export declare const createQuranRecitation: (id: number, quranRecitationInput: QuranRecitationInput, options?: Parameters<typeof customFetch>[1]) => Promise<QuranRecitation>;
export declare const getCreateQuranRecitationMutationKey: () => readonly ["createQuranRecitation"];
export declare const getCreateQuranRecitationMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createQuranRecitation>>, TError, CreateQuranRecitationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createQuranRecitation>>, TError, CreateQuranRecitationMutationVariables, TContext>;
export type CreateQuranRecitationMutationResult = NonNullable<Awaited<ReturnType<typeof createQuranRecitation>>>;
export type CreateQuranRecitationMutationBody = BodyType<QuranRecitationInput>;
export type CreateQuranRecitationMutationError = ErrorType<void>;
export type CreateQuranRecitationMutationVariables = {
    id: number;
    data: BodyType<QuranRecitationInput>;
};
/**
* @summary Save a recitation and update progress transactionally
*/
export declare const useCreateQuranRecitation: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createQuranRecitation>>, TError, CreateQuranRecitationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createQuranRecitation>>, TError, CreateQuranRecitationMutationVariables, TContext>;
export declare const getGetQuranReviewQueueUrl: () => string;
/**
 * @summary List due and review wards
 */
export declare const getQuranReviewQueue: (options?: Parameters<typeof customFetch>[1]) => Promise<QuranReviewWard[]>;
export declare const getGetQuranReviewQueueQueryKey: () => readonly ["/api/quran/review-queue"];
export declare const getGetQuranReviewQueueQueryOptions: <TData = Awaited<ReturnType<typeof getQuranReviewQueue>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranReviewQueue>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getQuranReviewQueue>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetQuranReviewQueueQueryResult = NonNullable<Awaited<ReturnType<typeof getQuranReviewQueue>>>;
export type GetQuranReviewQueueQueryError = ErrorType<unknown>;
/**
 * @summary List due and review wards
 */
export declare function useGetQuranReviewQueue<TData = Awaited<ReturnType<typeof getQuranReviewQueue>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranReviewQueue>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getPrepareQuranSubmissionUploadUrl: () => string;
/**
 * @summary Prepare a private Quran audio upload for the signed-in student
 */
export declare const prepareQuranSubmissionUpload: (quranSubmissionUploadInput: QuranSubmissionUploadInput, options?: Parameters<typeof customFetch>[1]) => Promise<QuranSubmissionUploadResponse>;
export declare const getPrepareQuranSubmissionUploadMutationKey: () => readonly ["prepareQuranSubmissionUpload"];
export declare const getPrepareQuranSubmissionUploadMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof prepareQuranSubmissionUpload>>, TError, PrepareQuranSubmissionUploadMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof prepareQuranSubmissionUpload>>, TError, PrepareQuranSubmissionUploadMutationVariables, TContext>;
export type PrepareQuranSubmissionUploadMutationResult = NonNullable<Awaited<ReturnType<typeof prepareQuranSubmissionUpload>>>;
export type PrepareQuranSubmissionUploadMutationBody = BodyType<QuranSubmissionUploadInput>;
export type PrepareQuranSubmissionUploadMutationError = ErrorType<void>;
export type PrepareQuranSubmissionUploadMutationVariables = {
    data: BodyType<QuranSubmissionUploadInput>;
};
/**
* @summary Prepare a private Quran audio upload for the signed-in student
*/
export declare const usePrepareQuranSubmissionUpload: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof prepareQuranSubmissionUpload>>, TError, PrepareQuranSubmissionUploadMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof prepareQuranSubmissionUpload>>, TError, PrepareQuranSubmissionUploadMutationVariables, TContext>;
export declare const getListMyQuranSubmissionsUrl: () => string;
/**
 * @summary List Quran audio submissions owned by the signed-in student
 */
export declare const listMyQuranSubmissions: (options?: Parameters<typeof customFetch>[1]) => Promise<QuranSubmission[]>;
export declare const getListMyQuranSubmissionsQueryKey: () => readonly ["/api/quran/me/submissions"];
export declare const getListMyQuranSubmissionsQueryOptions: <TData = Awaited<ReturnType<typeof listMyQuranSubmissions>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMyQuranSubmissions>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listMyQuranSubmissions>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListMyQuranSubmissionsQueryResult = NonNullable<Awaited<ReturnType<typeof listMyQuranSubmissions>>>;
export type ListMyQuranSubmissionsQueryError = ErrorType<void>;
/**
 * @summary List Quran audio submissions owned by the signed-in student
 */
export declare function useListMyQuranSubmissions<TData = Awaited<ReturnType<typeof listMyQuranSubmissions>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMyQuranSubmissions>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getFinalizeQuranSubmissionUrl: () => string;
/**
 * @summary Finalize an uploaded Quran audio submission
 */
export declare const finalizeQuranSubmission: (quranSubmissionFinalizeInput: QuranSubmissionFinalizeInput, options?: Parameters<typeof customFetch>[1]) => Promise<QuranSubmission>;
export declare const getFinalizeQuranSubmissionMutationKey: () => readonly ["finalizeQuranSubmission"];
export declare const getFinalizeQuranSubmissionMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof finalizeQuranSubmission>>, TError, FinalizeQuranSubmissionMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof finalizeQuranSubmission>>, TError, FinalizeQuranSubmissionMutationVariables, TContext>;
export type FinalizeQuranSubmissionMutationResult = NonNullable<Awaited<ReturnType<typeof finalizeQuranSubmission>>>;
export type FinalizeQuranSubmissionMutationBody = BodyType<QuranSubmissionFinalizeInput>;
export type FinalizeQuranSubmissionMutationError = ErrorType<void>;
export type FinalizeQuranSubmissionMutationVariables = {
    data: BodyType<QuranSubmissionFinalizeInput>;
};
/**
* @summary Finalize an uploaded Quran audio submission
*/
export declare const useFinalizeQuranSubmission: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof finalizeQuranSubmission>>, TError, FinalizeQuranSubmissionMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof finalizeQuranSubmission>>, TError, FinalizeQuranSubmissionMutationVariables, TContext>;
export declare const getGetMyQuranSubmissionUrl: (id: number) => string;
/**
 * @summary Get one Quran submission owned by the signed-in student
 */
export declare const getMyQuranSubmission: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<QuranSubmission>;
export declare const getGetMyQuranSubmissionQueryKey: (id: number) => readonly [`/api/quran/me/submissions/${number}`];
export declare const getGetMyQuranSubmissionQueryOptions: <TData = Awaited<ReturnType<typeof getMyQuranSubmission>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMyQuranSubmission>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMyQuranSubmission>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMyQuranSubmissionQueryResult = NonNullable<Awaited<ReturnType<typeof getMyQuranSubmission>>>;
export type GetMyQuranSubmissionQueryError = ErrorType<void>;
/**
 * @summary Get one Quran submission owned by the signed-in student
 */
export declare function useGetMyQuranSubmission<TData = Awaited<ReturnType<typeof getMyQuranSubmission>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMyQuranSubmission>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListQuranSubmissionReviewQueueUrl: () => string;
/**
 * @summary List actionable student Quran audio submissions for a teacher
 */
export declare const listQuranSubmissionReviewQueue: (options?: Parameters<typeof customFetch>[1]) => Promise<QuranSubmissionReviewItem[]>;
export declare const getListQuranSubmissionReviewQueueQueryKey: () => readonly ["/api/quran/submissions/review-queue"];
export declare const getListQuranSubmissionReviewQueueQueryOptions: <TData = Awaited<ReturnType<typeof listQuranSubmissionReviewQueue>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listQuranSubmissionReviewQueue>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listQuranSubmissionReviewQueue>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListQuranSubmissionReviewQueueQueryResult = NonNullable<Awaited<ReturnType<typeof listQuranSubmissionReviewQueue>>>;
export type ListQuranSubmissionReviewQueueQueryError = ErrorType<void>;
/**
 * @summary List actionable student Quran audio submissions for a teacher
 */
export declare function useListQuranSubmissionReviewQueue<TData = Awaited<ReturnType<typeof listQuranSubmissionReviewQueue>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listQuranSubmissionReviewQueue>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetQuranSubmissionAudioUrlUrl: (id: number) => string;
/**
 * @summary Get a short-lived protected audio URL for an owned submission
 */
export declare const getQuranSubmissionAudioUrl: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<QuranSubmissionAudioUrl>;
export declare const getGetQuranSubmissionAudioUrlQueryKey: (id: number) => readonly [`/api/quran/submissions/${number}/audio-url`];
export declare const getGetQuranSubmissionAudioUrlQueryOptions: <TData = Awaited<ReturnType<typeof getQuranSubmissionAudioUrl>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranSubmissionAudioUrl>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getQuranSubmissionAudioUrl>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetQuranSubmissionAudioUrlQueryResult = NonNullable<Awaited<ReturnType<typeof getQuranSubmissionAudioUrl>>>;
export type GetQuranSubmissionAudioUrlQueryError = ErrorType<void>;
/**
 * @summary Get a short-lived protected audio URL for an owned submission
 */
export declare function useGetQuranSubmissionAudioUrl<TData = Awaited<ReturnType<typeof getQuranSubmissionAudioUrl>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranSubmissionAudioUrl>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getReviewQuranSubmissionUrl: (id: number) => string;
/**
 * @summary Review a student Quran audio submission
 */
export declare const reviewQuranSubmission: (id: number, quranSubmissionReviewInput: QuranSubmissionReviewInput, options?: Parameters<typeof customFetch>[1]) => Promise<QuranSubmission>;
export declare const getReviewQuranSubmissionMutationKey: () => readonly ["reviewQuranSubmission"];
export declare const getReviewQuranSubmissionMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof reviewQuranSubmission>>, TError, ReviewQuranSubmissionMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof reviewQuranSubmission>>, TError, ReviewQuranSubmissionMutationVariables, TContext>;
export type ReviewQuranSubmissionMutationResult = NonNullable<Awaited<ReturnType<typeof reviewQuranSubmission>>>;
export type ReviewQuranSubmissionMutationBody = BodyType<QuranSubmissionReviewInput>;
export type ReviewQuranSubmissionMutationError = ErrorType<void>;
export type ReviewQuranSubmissionMutationVariables = {
    id: number;
    data: BodyType<QuranSubmissionReviewInput>;
};
/**
* @summary Review a student Quran audio submission
*/
export declare const useReviewQuranSubmission: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof reviewQuranSubmission>>, TError, ReviewQuranSubmissionMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof reviewQuranSubmission>>, TError, ReviewQuranSubmissionMutationVariables, TContext>;
export declare const getGetQuranTodayDashboardUrl: () => string;
/**
 * @summary Get today's Quran recitation and review queue
 */
export declare const getQuranTodayDashboard: (options?: Parameters<typeof customFetch>[1]) => Promise<QuranTodayDashboard>;
export declare const getGetQuranTodayDashboardQueryKey: () => readonly ["/api/quran/today"];
export declare const getGetQuranTodayDashboardQueryOptions: <TData = Awaited<ReturnType<typeof getQuranTodayDashboard>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranTodayDashboard>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getQuranTodayDashboard>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetQuranTodayDashboardQueryResult = NonNullable<Awaited<ReturnType<typeof getQuranTodayDashboard>>>;
export type GetQuranTodayDashboardQueryError = ErrorType<unknown>;
/**
 * @summary Get today's Quran recitation and review queue
 */
export declare function useGetQuranTodayDashboard<TData = Awaited<ReturnType<typeof getQuranTodayDashboard>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranTodayDashboard>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetQuranReaderStateUrl: () => string;
export declare const getQuranReaderState: (options?: Parameters<typeof customFetch>[1]) => Promise<QuranReaderState>;
export declare const getGetQuranReaderStateQueryKey: () => readonly ["/api/quran/reader-state"];
export declare const getGetQuranReaderStateQueryOptions: <TData = Awaited<ReturnType<typeof getQuranReaderState>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranReaderState>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getQuranReaderState>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetQuranReaderStateQueryResult = NonNullable<Awaited<ReturnType<typeof getQuranReaderState>>>;
export type GetQuranReaderStateQueryError = ErrorType<void>;
export declare function useGetQuranReaderState<TData = Awaited<ReturnType<typeof getQuranReaderState>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranReaderState>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateQuranReaderPositionUrl: () => string;
export declare const updateQuranReaderPosition: (updateQuranReaderPositionBody: UpdateQuranReaderPosition, options?: Parameters<typeof customFetch>[1]) => Promise<QuranReaderPosition>;
export declare const getUpdateQuranReaderPositionMutationKey: () => readonly ["updateQuranReaderPosition"];
export declare const getUpdateQuranReaderPositionMutationOptions: <TError = ErrorType<void | QuranReaderPositionConflict>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateQuranReaderPosition>>, TError, UpdateQuranReaderPositionMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateQuranReaderPosition>>, TError, UpdateQuranReaderPositionMutationVariables, TContext>;
export type UpdateQuranReaderPositionMutationResult = NonNullable<Awaited<ReturnType<typeof updateQuranReaderPosition>>>;
export type UpdateQuranReaderPositionMutationBody = BodyType<UpdateQuranReaderPosition>;
export type UpdateQuranReaderPositionMutationError = ErrorType<void | QuranReaderPositionConflict>;
export type UpdateQuranReaderPositionMutationVariables = {
    data: BodyType<UpdateQuranReaderPosition>;
};
export declare const useUpdateQuranReaderPosition: <TError = ErrorType<void | QuranReaderPositionConflict>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateQuranReaderPosition>>, TError, UpdateQuranReaderPositionMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateQuranReaderPosition>>, TError, UpdateQuranReaderPositionMutationVariables, TContext>;
export declare const getAddQuranBookmarkUrl: (surahNumber: number, ayahNumber: number) => string;
export declare const addQuranBookmark: (surahNumber: number, ayahNumber: number, quranBookmarkInput: QuranBookmarkInput, options?: Parameters<typeof customFetch>[1]) => Promise<QuranBookmark>;
export declare const getAddQuranBookmarkMutationKey: () => readonly ["addQuranBookmark"];
export declare const getAddQuranBookmarkMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof addQuranBookmark>>, TError, AddQuranBookmarkMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof addQuranBookmark>>, TError, AddQuranBookmarkMutationVariables, TContext>;
export type AddQuranBookmarkMutationResult = NonNullable<Awaited<ReturnType<typeof addQuranBookmark>>>;
export type AddQuranBookmarkMutationBody = BodyType<QuranBookmarkInput>;
export type AddQuranBookmarkMutationError = ErrorType<unknown>;
export type AddQuranBookmarkMutationVariables = {
    surahNumber: number;
    ayahNumber: number;
    data: BodyType<QuranBookmarkInput>;
};
export declare const useAddQuranBookmark: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof addQuranBookmark>>, TError, AddQuranBookmarkMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof addQuranBookmark>>, TError, AddQuranBookmarkMutationVariables, TContext>;
export declare const getDeleteQuranBookmarkUrl: (surahNumber: number, ayahNumber: number) => string;
export declare const deleteQuranBookmark: (surahNumber: number, ayahNumber: number, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getDeleteQuranBookmarkMutationKey: () => readonly ["deleteQuranBookmark"];
export declare const getDeleteQuranBookmarkMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteQuranBookmark>>, TError, DeleteQuranBookmarkMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteQuranBookmark>>, TError, DeleteQuranBookmarkMutationVariables, TContext>;
export type DeleteQuranBookmarkMutationResult = NonNullable<Awaited<ReturnType<typeof deleteQuranBookmark>>>;
export type DeleteQuranBookmarkMutationError = ErrorType<unknown>;
export type DeleteQuranBookmarkMutationVariables = {
    surahNumber: number;
    ayahNumber: number;
};
export declare const useDeleteQuranBookmark: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteQuranBookmark>>, TError, DeleteQuranBookmarkMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteQuranBookmark>>, TError, DeleteQuranBookmarkMutationVariables, TContext>;
export declare const getGetMyQuranMemorizationUrl: () => string;
/**
 * @summary Get the student's guided memorization items
 */
export declare const getMyQuranMemorization: (options?: Parameters<typeof customFetch>[1]) => Promise<QuranMemorizationItem[]>;
export declare const getGetMyQuranMemorizationQueryKey: () => readonly ["/api/quran/me/memorization"];
export declare const getGetMyQuranMemorizationQueryOptions: <TData = Awaited<ReturnType<typeof getMyQuranMemorization>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMyQuranMemorization>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMyQuranMemorization>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMyQuranMemorizationQueryResult = NonNullable<Awaited<ReturnType<typeof getMyQuranMemorization>>>;
export type GetMyQuranMemorizationQueryError = ErrorType<void>;
/**
 * @summary Get the student's guided memorization items
 */
export declare function useGetMyQuranMemorization<TData = Awaited<ReturnType<typeof getMyQuranMemorization>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMyQuranMemorization>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getAssessMyQuranMemorizationUrl: () => string;
/**
 * @summary Assess one memorization verse
 */
export declare const assessMyQuranMemorization: (quranMemorizationAssessment: QuranMemorizationAssessment, options?: Parameters<typeof customFetch>[1]) => Promise<QuranMemorizationItem>;
export declare const getAssessMyQuranMemorizationMutationKey: () => readonly ["assessMyQuranMemorization"];
export declare const getAssessMyQuranMemorizationMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof assessMyQuranMemorization>>, TError, AssessMyQuranMemorizationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof assessMyQuranMemorization>>, TError, AssessMyQuranMemorizationMutationVariables, TContext>;
export type AssessMyQuranMemorizationMutationResult = NonNullable<Awaited<ReturnType<typeof assessMyQuranMemorization>>>;
export type AssessMyQuranMemorizationMutationBody = BodyType<QuranMemorizationAssessment>;
export type AssessMyQuranMemorizationMutationError = ErrorType<void>;
export type AssessMyQuranMemorizationMutationVariables = {
    data: BodyType<QuranMemorizationAssessment>;
};
/**
* @summary Assess one memorization verse
*/
export declare const useAssessMyQuranMemorization: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof assessMyQuranMemorization>>, TError, AssessMyQuranMemorizationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof assessMyQuranMemorization>>, TError, AssessMyQuranMemorizationMutationVariables, TContext>;
export declare const getGetDueQuranMemorizationUrl: () => string;
/**
 * @summary Get memorization items due today
 */
export declare const getDueQuranMemorization: (options?: Parameters<typeof customFetch>[1]) => Promise<QuranMemorizationItem[]>;
export declare const getGetDueQuranMemorizationQueryKey: () => readonly ["/api/quran/me/memorization/due"];
export declare const getGetDueQuranMemorizationQueryOptions: <TData = Awaited<ReturnType<typeof getDueQuranMemorization>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDueQuranMemorization>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getDueQuranMemorization>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetDueQuranMemorizationQueryResult = NonNullable<Awaited<ReturnType<typeof getDueQuranMemorization>>>;
export type GetDueQuranMemorizationQueryError = ErrorType<void>;
/**
 * @summary Get memorization items due today
 */
export declare function useGetDueQuranMemorization<TData = Awaited<ReturnType<typeof getDueQuranMemorization>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDueQuranMemorization>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetQuranMemorizationSummaryUrl: () => string;
/**
 * @summary Get guided memorization summary
 */
export declare const getQuranMemorizationSummary: (options?: Parameters<typeof customFetch>[1]) => Promise<QuranMemorizationSummary>;
export declare const getGetQuranMemorizationSummaryQueryKey: () => readonly ["/api/quran/me/memorization/summary"];
export declare const getGetQuranMemorizationSummaryQueryOptions: <TData = Awaited<ReturnType<typeof getQuranMemorizationSummary>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranMemorizationSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getQuranMemorizationSummary>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetQuranMemorizationSummaryQueryResult = NonNullable<Awaited<ReturnType<typeof getQuranMemorizationSummary>>>;
export type GetQuranMemorizationSummaryQueryError = ErrorType<void>;
/**
 * @summary Get guided memorization summary
 */
export declare function useGetQuranMemorizationSummary<TData = Awaited<ReturnType<typeof getQuranMemorizationSummary>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQuranMemorizationSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetTeacherQuranMemorizationSummaryUrl: () => string;
/**
 * @summary Aggregate guided memorization for the teacher's entire roster
 */
export declare const getTeacherQuranMemorizationSummary: (options?: Parameters<typeof customFetch>[1]) => Promise<TeacherQuranMemorizationSummary>;
export declare const getGetTeacherQuranMemorizationSummaryQueryKey: () => readonly ["/api/quran/teacher/memorization/summary"];
export declare const getGetTeacherQuranMemorizationSummaryQueryOptions: <TData = Awaited<ReturnType<typeof getTeacherQuranMemorizationSummary>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTeacherQuranMemorizationSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getTeacherQuranMemorizationSummary>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetTeacherQuranMemorizationSummaryQueryResult = NonNullable<Awaited<ReturnType<typeof getTeacherQuranMemorizationSummary>>>;
export type GetTeacherQuranMemorizationSummaryQueryError = ErrorType<void>;
/**
 * @summary Aggregate guided memorization for the teacher's entire roster
 */
export declare function useGetTeacherQuranMemorizationSummary<TData = Awaited<ReturnType<typeof getTeacherQuranMemorizationSummary>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTeacherQuranMemorizationSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListTeacherQuranMemorizationStudentsUrl: () => string;
/**
 * @summary Summarize guided memorization for every owned roster student
 */
export declare const listTeacherQuranMemorizationStudents: (options?: Parameters<typeof customFetch>[1]) => Promise<TeacherQuranMemorizationStudent[]>;
export declare const getListTeacherQuranMemorizationStudentsQueryKey: () => readonly ["/api/quran/teacher/memorization/students"];
export declare const getListTeacherQuranMemorizationStudentsQueryOptions: <TData = Awaited<ReturnType<typeof listTeacherQuranMemorizationStudents>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTeacherQuranMemorizationStudents>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listTeacherQuranMemorizationStudents>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListTeacherQuranMemorizationStudentsQueryResult = NonNullable<Awaited<ReturnType<typeof listTeacherQuranMemorizationStudents>>>;
export type ListTeacherQuranMemorizationStudentsQueryError = ErrorType<void>;
/**
 * @summary Summarize guided memorization for every owned roster student
 */
export declare function useListTeacherQuranMemorizationStudents<TData = Awaited<ReturnType<typeof listTeacherQuranMemorizationStudents>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTeacherQuranMemorizationStudents>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListTeacherQuranMemorizationItemsUrl: (studentId: number, params?: ListTeacherQuranMemorizationItemsParams) => string;
/**
 * @summary Get guided memorization items for an owned student
 */
export declare const listTeacherQuranMemorizationItems: (studentId: number, params?: ListTeacherQuranMemorizationItemsParams, options?: Parameters<typeof customFetch>[1]) => Promise<TeacherQuranMemorizationItems>;
export declare const getListTeacherQuranMemorizationItemsQueryKey: (studentId: number, params?: ListTeacherQuranMemorizationItemsParams) => readonly [`/api/quran/teacher/memorization/students/${number}`, ...ListTeacherQuranMemorizationItemsParams[]];
export declare const getListTeacherQuranMemorizationItemsQueryOptions: <TData = Awaited<ReturnType<typeof listTeacherQuranMemorizationItems>>, TError = ErrorType<void>>(studentId: number, params?: ListTeacherQuranMemorizationItemsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTeacherQuranMemorizationItems>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listTeacherQuranMemorizationItems>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListTeacherQuranMemorizationItemsQueryResult = NonNullable<Awaited<ReturnType<typeof listTeacherQuranMemorizationItems>>>;
export type ListTeacherQuranMemorizationItemsQueryError = ErrorType<void>;
/**
 * @summary Get guided memorization items for an owned student
 */
export declare function useListTeacherQuranMemorizationItems<TData = Awaited<ReturnType<typeof listTeacherQuranMemorizationItems>>, TError = ErrorType<void>>(studentId: number, params?: ListTeacherQuranMemorizationItemsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTeacherQuranMemorizationItems>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListTeacherQuranMemorizationHistoryUrl: (studentId: number) => string;
/**
 * @summary Get immutable guided memorization assessment history
 */
export declare const listTeacherQuranMemorizationHistory: (studentId: number, options?: Parameters<typeof customFetch>[1]) => Promise<TeacherQuranMemorizationHistoryEvent[]>;
export declare const getListTeacherQuranMemorizationHistoryQueryKey: (studentId: number) => readonly [`/api/quran/teacher/memorization/students/${number}/history`];
export declare const getListTeacherQuranMemorizationHistoryQueryOptions: <TData = Awaited<ReturnType<typeof listTeacherQuranMemorizationHistory>>, TError = ErrorType<void>>(studentId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTeacherQuranMemorizationHistory>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listTeacherQuranMemorizationHistory>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListTeacherQuranMemorizationHistoryQueryResult = NonNullable<Awaited<ReturnType<typeof listTeacherQuranMemorizationHistory>>>;
export type ListTeacherQuranMemorizationHistoryQueryError = ErrorType<void>;
/**
 * @summary Get immutable guided memorization assessment history
 */
export declare function useListTeacherQuranMemorizationHistory<TData = Awaited<ReturnType<typeof listTeacherQuranMemorizationHistory>>, TError = ErrorType<void>>(studentId: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTeacherQuranMemorizationHistory>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export {};
//# sourceMappingURL=api.d.ts.map