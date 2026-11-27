import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Live room',
    description: 'Race friends on the same idol. Each guess is yours alone.',
}

export default function MultiplayerLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return children
}
