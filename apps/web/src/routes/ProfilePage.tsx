import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme, type Theme } from '@/lib/theme';

const options: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
  { value: 'system', label: 'System' },
];

export function ProfilePage() {
  const { theme, setTheme } = useTheme();

  return (
    <>
      <PageHeader title="Profil" description="Konto und Einstellungen." />
      <Card>
        <CardHeader>
          <CardTitle>Darstellung</CardTitle>
          <CardDescription>Wähle Hell, Dunkel oder die Einstellung deines Geräts.</CardDescription>
        </CardHeader>
        <CardContent>
          <div role="group" aria-label="Farbschema" className="flex flex-wrap gap-2">
            {options.map(({ value, label }) => (
              <Button
                key={value}
                variant={theme === value ? 'default' : 'outline'}
                aria-pressed={theme === value}
                onClick={() => {
                  setTheme(value);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
