import WaterOpsWidget from './WaterOpsWidget'
import WidgetErrorBoundary from './WidgetErrorBoundary'

/** Water & Environmental Management add-on. Multi-asset (Pool, Pond, Fountain). */
export default function WaterManagementPage({ supportRequests, setSupportRequests, currentUser }) {
  return (
    <section>
      <WidgetErrorBoundary>
        <WaterOpsWidget
          setSupportRequests={setSupportRequests}
          currentUser={currentUser}
        />
      </WidgetErrorBoundary>
    </section>
  )
}
