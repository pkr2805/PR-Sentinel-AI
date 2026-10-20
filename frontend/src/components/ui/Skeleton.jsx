export default function Skeleton({ width = '100%', height = 14, radius, style }) {
    return <div className="skeleton" style={{ width, height, borderRadius: radius, ...style }} />;
}

export function CardSkeleton({ lines = 3, height = 150 }) {
    return (
        <div className="card card-pad" style={{ minHeight: height }}>
            <div className="row" style={{ gap: 12, marginBottom: 16 }}>
                <Skeleton width={34} height={34} radius={10} />
                <div className="col" style={{ flex: 1, gap: 8 }}>
                    <Skeleton width="70%" />
                    <Skeleton width="40%" height={10} />
                </div>
            </div>
            {Array.from({ length: lines }, (_, i) => (
                <Skeleton key={i} width={`${90 - i * 18}%`} height={10} style={{ marginTop: 10 }} />
            ))}
        </div>
    );
}
