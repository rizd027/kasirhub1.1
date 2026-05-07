import CustomMenuPageClient from './page-client';

export const dynamicParams = false;

export async function generateStaticParams() {
  return [{ slug: 'default' }];
}

export default function CustomMenuPage() {
  return <CustomMenuPageClient />;
}
