import PondHealthWidget from './PondHealthWidget'
import WidgetErrorBoundary from './WidgetErrorBoundary'

/** Water & Environmental Management add-on. Rebranded Pond module. */
export default function WaterManagementPage({ supportRequests, setSupportRequests, currentUser }) {
  return (
    <section>
      <WidgetErrorBoundary>
        <PondHealthWidget
          setSupportRequests={setSupportRequests}
          currentUser={currentUser}
        />
      </WidgetErrorBoundary>
    </section>
  )
}
