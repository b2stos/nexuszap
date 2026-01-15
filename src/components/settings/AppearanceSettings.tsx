import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { Monitor, Moon, Sun, Check } from 'lucide-react';
import { Theme, AccentColor, UserSettings } from '@/hooks/useUserSettings';

interface AppearanceSettingsProps {
  settings: UserSettings;
  onUpdate: (updates: Partial<UserSettings>) => void;
  isSaving: boolean;
}

const themeOptions = [
  { value: 'light' as Theme, label: 'Claro', icon: Sun },
  { value: 'dark' as Theme, label: 'Escuro', icon: Moon },
  { value: 'system' as Theme, label: 'Sistema', icon: Monitor },
];

const accentColors: { value: AccentColor; label: string; class: string }[] = [
  { value: 'cyan', label: 'Ciano', class: 'bg-[hsl(200,85%,45%)]' },
  { value: 'blue', label: 'Azul', class: 'bg-[hsl(220,85%,50%)]' },
  { value: 'purple', label: 'Roxo', class: 'bg-[hsl(270,85%,55%)]' },
  { value: 'green', label: 'Verde', class: 'bg-[hsl(150,80%,40%)]' },
  { value: 'orange', label: 'Laranja', class: 'bg-[hsl(25,90%,50%)]' },
  { value: 'red', label: 'Vermelho', class: 'bg-[hsl(0,85%,55%)]' },
  { value: 'pink', label: 'Rosa', class: 'bg-[hsl(330,85%,55%)]' },
  { value: 'slate', label: 'Cinza', class: 'bg-[hsl(220,15%,45%)]' },
];

export function AppearanceSettings({ settings, onUpdate, isSaving }: AppearanceSettingsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Aparência</h3>
        <p className="text-sm text-muted-foreground">
          Personalize a aparência do app
        </p>
      </div>

      {/* Theme Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tema</CardTitle>
          <CardDescription>Escolha entre claro, escuro ou automático</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={settings.theme}
            onValueChange={(value) => onUpdate({ theme: value as Theme })}
            className="grid grid-cols-3 gap-4"
            disabled={isSaving}
          >
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = settings.theme === option.value;
              
              return (
                <Label
                  key={option.value}
                  htmlFor={option.value}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-colors',
                    isSelected 
                      ? 'border-primary bg-primary/5' 
                      : 'border-muted hover:border-muted-foreground/50'
                  )}
                >
                  <RadioGroupItem
                    value={option.value}
                    id={option.value}
                    className="sr-only"
                  />
                  <Icon className={cn('h-6 w-6', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                  <span className={cn('text-sm font-medium', isSelected && 'text-primary')}>
                    {option.label}
                  </span>
                </Label>
              );
            })}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Accent Color Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cor de Destaque</CardTitle>
          <CardDescription>Escolha a cor principal da interface</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {accentColors.map((color) => {
              const isSelected = settings.accent_color === color.value;
              
              return (
                <button
                  key={color.value}
                  onClick={() => onUpdate({ accent_color: color.value })}
                  disabled={isSaving}
                  className={cn(
                    'relative w-10 h-10 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary',
                    color.class,
                    isSelected && 'ring-2 ring-offset-2 ring-foreground'
                  )}
                  title={color.label}
                  aria-label={color.label}
                >
                  {isSelected && (
                    <Check className="absolute inset-0 m-auto h-5 w-5 text-white" />
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Cor atual: <span className="font-medium capitalize">{settings.accent_color}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
