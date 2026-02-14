import PondHealthWidget from './PondHealthWidget'

/** Water & Environmental Management add-on. Rebranded Pond module. */
export default function WaterManagementPage({ supportRequests, setSupportRequests, currentUser }) {
  return (
    <section>
      <PondHealthWidget
        setSupportRequests={setSupportRequests}
        currentUser={currentUser}
      />
    </section>
  )
}
