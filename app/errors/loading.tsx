export default function Loading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="h-8 w-36 rounded-lg animate-pulse" style={{ background: 'rgba(109,40,217,0.15)' }} />
        <div className="h-4 w-64 mt-2 rounded animate-pulse" style={{ background: 'rgba(109,40,217,0.08)' }} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: 'rgba(109,40,217,0.08)' }} />
        ))}
      </div>
      <div className="h-12 rounded-xl animate-pulse mb-6" style={{ background: 'rgba(109,40,217,0.06)' }} />
      <div className="h-96 rounded-xl animate-pulse" style={{ background: 'rgba(109,40,217,0.06)' }} />
    </div>
  )
}
