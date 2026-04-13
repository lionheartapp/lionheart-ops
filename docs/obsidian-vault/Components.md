---
aliases: [Component Inventory, UI Components]
tags: [architecture, components, react]
created: 2026-04-08
---

# Component Inventory (~291 .tsx files)

> Last updated: 2026-03-31. Check actual files if unsure — this is a reference, not source of truth.

## Shared/Reusable Components (USE THESE FIRST)

| Component | File | Key Props | Use For |
|-----------|------|-----------|---------|
| `DetailDrawer` | `components/DetailDrawer.tsx` | `isOpen, onClose, title, children, footer?, width?` | All slide-in panels |
| `ConfirmDialog` | `components/ConfirmDialog.tsx` | `isOpen, onClose, onConfirm, title, message, requireText?, variant?` | Destructive action confirmation |
| `EmptyState` | `components/EmptyState.tsx` | `icon, title, description?, action?` | Empty lists/grids |
| `ErrorAlert` | `components/ErrorAlert.tsx` | `message, variant?` | Error display |
| `LoadingState` | `components/LoadingState.tsx` | `variant?, label?` | Spinners (inline/section/page) |
| `ModuleGate` | `components/ModuleGate.tsx` | `moduleId, children, fallback?` | Gating add-on features |
| `RowActionMenu` | `components/RowActionMenu.tsx` | `items: ActionMenuItem[]` | Table row "..." menus |
| `CreateModal` | `components/CreateModal.tsx` | `isOpen, onClose, title, children` | Generic creation modals |
| `Toast` | `components/Toast.tsx` | Provider + `useToast()` hook | Notifications |
| `FloatingInput/Select/Textarea/Dropdown` | `components/ui/FloatingInput.tsx` | `label`, standard attrs; Dropdown: `options[]` | All form inputs — see [[UI Design System#Filter Dropdowns (Current Standard)]] |
| `AnimatedCounter` | `components/motion/AnimatedCounter.tsx` | `value, duration?, className?` | Stat cards — see [[Animation System]] |
| `PageTransition` | `components/motion/PageTransition.tsx` | `children, className?, stagger?` | Page wrappers — see [[Animation System]] |
| `StaggerList` | `components/motion/StaggerList.tsx` | `children, as?, stagger?` | Animated lists — see [[Animation System]] |
| `AddressAutocomplete` | `components/AddressAutocomplete.tsx` | `value, onChange` | Address inputs |
| `PasswordInput` | `components/PasswordInput.tsx` | `value, onChange, showRules?` | Password fields |
| `ImageDropZone` | `settings/ImageDropZone.tsx` | `label, imageUrl, imageType, onImageChange` | Logo/hero uploads |
| `ImageUpload` | `settings/ImageUpload.tsx` | `entityType, entityId, images, onImagesChange` | Multi-image uploads |
| `PhotoLightbox` | `settings/PhotoLightbox.tsx` | `images, initialIndex?, isOpen, onClose` | Full-screen image viewer |
| `PermissionToggleList` | `settings/PermissionToggleList.tsx` | `items, onToggle, mode` | Role/user permission editing |

## Illustrations (13 files)

All in `components/illustrations/`, export SVGs with aurora gradient fill (see [[UI Design System#Brand Gradient — "Aurora"]]):

`IllustrationAthletics`, `IllustrationCalendar`, `IllustrationCampus`, `IllustrationCompliance`, `IllustrationDeployment`, `IllustrationDevices`, `IllustrationAnalytics`, `IllustrationKnowledgeBase`, `IllustrationMaintenance`, `IllustrationSecurity`, `IllustrationSync`, `IllustrationTeam`, `IllustrationTickets`

## Layout & Navigation

| Component | Description |
|-----------|-------------|
| `DashboardLayout` | Main app shell (sidebar, search, offline sync, page transitions) — see [[Animation System#What Was Animated]] |
| `Sidebar` | Full nav sidebar with campus tabs, user menu, animated tab indicator |
| `SearchCommand` | Cmd+K global search — see [[Completed Features#Global Search]] |
| `NotificationBell` | Bell icon + unread badge + dropdown — see [[Completed Features#Notifications & Communication]] |
| `NotificationPreferences` | Email/in-app notification toggles by module |
| `ImpersonationBanner` | Admin "viewing as" banner |
| `PrefetchLink` | Link wrapper with TanStack Query prefetch on hover |
| `ServiceWorkerRegistration` | Registers SW on mount |
| `Providers` | Root provider tree (QueryClient, Toast, CSRF, ChatButton) |
| `ViewAsDialog` | Admin impersonation picker |
| `ReportBugDialog` | Bug report submission |

## Settings (18 files)

`MembersTab`, `RolesTab`, `TeamsTab`, `CampusTab`, `SchoolInfoTab`, `SchoolsManagement`, `AddOnsTab`, `BillingTab`, `AuditLogTab`, `AcademicCalendarTab`, `ApprovalConfigTab`, `IntegrationsTab`, `CampusMap`, `InteractiveCampusMap` (Leaflet + [[AI Services]] building detection)

## Calendar (23 files)

**Core views**: `CalendarView` (orchestrator), `WeekView`, `DayView`, `MonthView`, `AgendaView`, `MobileMonthView`
**Panels**: `EventCreatePanel`, `EventDetailPanel`, `PlanEventDrawer`
**Drag**: `DraggableEvent` (Framer Motion drag/resize) — see [[Animation System]]
**Inputs**: `AttendeePicker`, `RecurrenceBuilder`
**Dialogs**: `RecurringEditDialog`, `NotifyAttendeesDialog`, `CancellationNotifyDialog`, `LocationConflictDialog`, `RsvpDialog`
**UI**: `CalendarToolbar`, `CalendarFilterPopover`, `MeetWithSection`, `CampusShapeIndicator`, `EventSkeletons`

## Events (~60 files)

**Core tabs**: `EventOverviewTab`, `EventScheduleTab`, `EventPeopleTab`, `EventTasksTab`, `EventBudgetTab`, `EventCommsTab`, `EventDocumentsTab`, `EventLogisticsTab`
**Shell**: `EventProjectTabs`, `EventSidebar`, `EventDashboard`, `EventActivityLog`, `EventSeriesDrawer`
**Creation**: `CreateEventProjectModal` (3-step wizard), `LocationPicker`
**Schedule**: `ExportScheduleDrawer` (see [[Completed Features#Export Schedule Drawer]]), `ParallelBlockGrid`, `ScheduleTimelineView`, `PCOServiceLinkModal`
**Approval**: `TeamApprovalQueue`
**AI**: `AIEventWizard`, `AIEventChat`, `AIEventPreview` — see [[AI Services]]
**Budget** (4): `BudgetExpenseDrawer`, `BudgetLineItemTable`, `BudgetReportView`, `BudgetRevenueSection`
**Comms** (7): `AnnouncementComposer/Feed`, `NotificationRuleDrawer`, `NotificationTimeline/Pin`, `PresenceBar`, `SurveyManager`
**Day-of** (6): `DayOfDashboard`, `CheckInList`, `CheckInScanner`, `IncidentForm/List`, `ParticipantFlashCard`
**Documents** (3): `ComplianceChecklist`, `DocumentMatrix`, `DocumentRequirementDrawer`
**Groups** (6): `GroupDragBoard`, `GroupCard`, `ParticipantCard`, `ActivityManager`, `DietaryMedicalReport`, `EventPDFGenerator`
**Registration** (3): `RegistrationTab`, `RegistrationManagement`, `ShareHub`
**Templates** (3): `CreateFromTemplateWizard`, `SaveAsTemplateDialog`, `TemplateListDrawer`

## AI Chat (15 files)

`ChatButton` (floating), `ChatPanel` (streaming SSE), `MessageList`, `InputForm` (voice + image + @mention), `ConversationSidebar`, `ActionConfirmation`, `RichConfirmationCard`, `WorkflowPlanCard`, `SuggestionChips`, `ChoiceButtons`, `MentionDropdown`, `StructuredList`, `AnimatedOrb`, `AiGlow`, `VoiceOrb`

All powered by [[AI Services|Gemini]] function calling.

## Athletics (19 files)

See [[Completed Features#Athletics (Phases 4-6)]] for feature details.

`AthleticsDashboard`, `SportsSection`, `TeamsSection`, `ScheduleSection`, `RosterSection`, `StatsSection`, `TournamentsSection`, `TournamentDetail`, `SeasonsPanel`, `GameDrawer`, `PracticeDrawer`, `ScoreDialog`, `MatchResultDialog`, `PlayerStatsDialog`, `SingleEliminationBracket`, `RoundRobinGrid`, `RRuleBuilder`, `SportIcon`/`GlassSportTile`, `AthleticsTableSkeleton`

## Maintenance (~55 files)

**Core**: `MaintenanceDashboard`, `TicketDetailPage`, `TicketDetailSidebar`, `TicketStatusTracker`, `TicketActivityFeed`, `TicketCard`, `TicketWatchers`, `TicketAssigneeSelect`
**Kanban**: `KanbanBoard`, `KanbanCard`, `KanbanColumn`
**Work Orders**: `WorkOrdersView`, `WorkOrdersTable`, `WorkOrdersFilters`
**Labor/Cost**: `LaborCostPanel`, `LaborCostSummaryCards`, `LaborEntryForm`, `LaborTimerButton`, `CostEntryForm`
**QA**: `QAReviewPanel`, `QACompletionModal`
**Submission**: `SubmitRequestWizard` (5 steps), `MyRequestsView`, `MyRequestsGrid`, `FilterBottomSheet`
**Assets**: `AssetDetailPage`, `AssetCreateDrawer`, `AssetRegisterTable`, `AssetRegisterFilters`, `AssetRepairGauge`
**PM**: `PmScheduleList`, `PmScheduleWizard`, `PmCalendarView`, `PmChecklistSection`
**Knowledge Base**: `KnowledgeBaseList`, `KnowledgeBaseSearchBar`, `KnowledgeBaseArticleEditor`, `KnowledgeBaseArticleViewer`
**Analytics**: `AnalyticsDashboard`, 6 chart components, `CampusComparisonWidget`, `CampusFilterChip`
**Board Report**: `BoardReportPage`, `FCIScoreCard`, `BoardMetricsGrid`, `ComplianceStatusPanel`, `AssetForecastPanel`, `GenerateReportDialog`
**Compliance**: `ComplianceCalendar`, `ComplianceDomainCard`, `ComplianceRecordDrawer`, `ComplianceSetupWizard`, `ComplianceAttachmentPanel`, `AuditExportDialog`
**Misc**: `AIDiagnosticPanel` (see [[AI Services]]), `QRCodeThumbnail`, `QRScannerModal`, `ConnectivityIndicator`, `OfflineBadge/SyncStatus`, `PPESafetyPanel`, `PondCareDosageCalculator`

## IT Help Desk (35 files)

See [[IT Help Desk]] for backend details and [[MDM and Roster]] for device/student management.

`ITPageShell`, `ITDashboard`, `ITDevicesTab`, `ITDeviceDetailDrawer`, `ITDeviceCreateDrawer`, `ITStudentsTab`, `ITStudentDetailDrawer`, `ITStudentCreateDrawer`, `ITTicketsList`, `ITTicketDetail`, `ITTicketCreateDrawer`, `ITKanbanBoard/Card/Column`, `ITDeploymentTab`, `ITDeploymentBatchDetail`, `ITDeploymentCreateDrawer`, `ITSummerTab`, `ITSummerBatchDetail`, `ITVendorRepairDialog`, `ITDamageReportDrawer`, `ITProvisioningTab`, `ITSyncTab`, `ITMdmConfigSection`, `ITMagicLinksTab`, `ITIntelligenceTab`, `ITAnalyticsTab`, `ITReportsTab`, `ITSecurityIncidentsTab`, `ITContentFiltersTab`, `ITERateTab`, `ITLoanersTab`, `ITAIDiagnosticPanel`, `ITActivityFeed`, status/priority/type badges, `ITSearchFilterBar`, skeletons

## Planning (7 files)

`MyEventsTab`, `MyEventsWidget`, `MySubmissions`, `PlanningSubmissionForm`, `PlanningSeasonAdmin`, `PlanningSeasonBanner`, `CommentThread`

## Registration (9 files)

`FormBuilder`, `SectionEditor`, `FormFieldEditor`, `CommonFieldPicker`, `RegistrationWizard`, `PortalView`, `PaymentStep` (Stripe), `SignatureField`, `TurnstileWidget` (Cloudflare CAPTCHA)

## Inventory (3 files)

`AVEquipmentWizard`, `StepEssentials`, `StepDetails`

## Onboarding (3 files)

`AnimatedFormField`, `OnboardingSidebar`, `StepTransition`

## Public/Marketing (2 files)

`PublicNav`, `PublicFooter`
