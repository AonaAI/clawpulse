export default function Loading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="h-8 w-48 rounded-lg animate-pulse" style={{ background: 'rgba(109,40,217,0.15)' }} />
        <div className="h-4 w-72 mt-2 rounded animate-pulse" style={{ background: 'rgba(109,40,217,0.08)' }} />
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[1,2,3].map(i => (
          <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'rgba(109,40,217,0.08)' }} />
        ))}
      </div>
      <div className="h-96 rounded-xl animate-pulse" style={{ background: 'rgba(109,40,217,0.06)' }} />
    </div>
  )
}
