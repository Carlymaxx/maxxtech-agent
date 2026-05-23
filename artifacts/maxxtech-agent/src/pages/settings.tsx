import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Settings as SettingsIcon, Terminal, MonitorSmartphone,
  Sun, Moon, Cpu, Wrench, Zap, Code2, Globe,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { MODEL_GROUPS } from "@/components/chat/chat-input";

const settingsSchema = z.object({
  agentName: z.string().min(1, "Agent name is required"),
  model: z.string(),
  systemPrompt: z.string(),
  enableCodeExecution: z.boolean(),
  enableWebSearch: z.boolean(),
  maxTokens: z.number().min(100).max(128000),
  temperature: z.number().min(0).max(2),
  theme: z.enum(["light", "dark", "system"]),
});

type SettingsValues = z.infer<typeof settingsSchema>;

export function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings({
    query: { queryKey: ["/api/settings"] },
  });
  const updateSettings = useUpdateSettings();
  const [activeTab, setActiveTab] = useState("general");

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      agentName: "MaxxTech Agent",
      model: "claude-sonnet-4-6",
      systemPrompt:
        "You are MaxxTech Agent, a powerful AI assistant built by CarlymaxX for tech and IT professionals. You can write and run code, search the web, automate tasks, and help with complex technical problems.",
      enableCodeExecution: true,
      enableWebSearch: true,
      maxTokens: 8192,
      temperature: 0.7,
      theme: "dark",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        agentName: settings.agentName,
        model: settings.model,
        systemPrompt: settings.systemPrompt,
        enableCodeExecution: settings.enableCodeExecution,
        enableWebSearch: settings.enableWebSearch,
        maxTokens: settings.maxTokens ?? 8192,
        temperature: settings.temperature ?? 0.7,
        theme: settings.theme as "light" | "dark" | "system",
      });
    }
  }, [settings, form]);

  const onSubmit = async (data: SettingsValues) => {
    try {
      await updateSettings.mutateAsync({ data });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings saved", description: "Preferences updated successfully." });
    } catch {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    }
  };

  const tabs = [
    { id: "general", label: "General", icon: SettingsIcon },
    { id: "model", label: "Model & AI", icon: Cpu },
    { id: "tools", label: "Tools", icon: Wrench },
    { id: "appearance", label: "Appearance", icon: MonitorSmartphone },
    { id: "about", label: "About", icon: Zap },
  ];

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full max-w-6xl mx-auto overflow-hidden bg-background">
      {/* Left nav */}
      <div className="w-60 border-r border-border bg-card/30 p-5 hidden md:flex flex-col">
        <h2 className="text-sm font-bold mb-5 font-mono tracking-tight flex items-center gap-2 text-foreground">
          <Terminal className="w-4 h-4 text-primary" />
          Agent Config
        </h2>
        <nav className="space-y-0.5 flex-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.id
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? "text-primary" : ""}`} />
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="pt-4 border-t border-border mt-4">
          <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
            Built by <span className="text-primary font-bold">CarlymaxX</span>
            <br />
            MaxxTech Agent v1.0
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-2xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

              {/* General */}
              {activeTab === "general" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h3 className="text-xl font-bold mb-1">General</h3>
                    <p className="text-sm text-muted-foreground mb-6">Core identity of your MaxxTech Agent.</p>
                  </div>
                  <FormField control={form.control} name="agentName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Name</FormLabel>
                      <FormControl>
                        <Input {...field} className="font-mono" data-testid="input-agent-name" />
                      </FormControl>
                      <FormDescription>Displayed in the interface and system prompt.</FormDescription>
                    </FormItem>
                  )} />
                </div>
              )}

              {/* Model & AI */}
              {activeTab === "model" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h3 className="text-xl font-bold mb-1">Model & AI</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Choose from Claude, Gemini, or OpenRouter models including Llama, DeepSeek, and Qwen.
                    </p>
                  </div>

                  <FormField control={form.control} name="model" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Model</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="font-mono" data-testid="select-default-model">
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MODEL_GROUPS.map((group) => (
                            <div key={group.provider}>
                              <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                {group.provider}
                              </div>
                              {group.models.map((m) => (
                                <SelectItem key={m.id} value={m.id} className="font-mono text-xs pl-4">
                                  {m.name}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The model used for all new conversations unless overridden per-chat.
                      </FormDescription>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="systemPrompt" render={({ field }) => (
                    <FormItem>
                      <FormLabel>System Prompt</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="h-40 font-mono text-sm" data-testid="textarea-system-prompt" />
                      </FormControl>
                      <FormDescription>The foundational instructions guiding the agent's behavior.</FormDescription>
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-2 gap-6">
                    <FormField control={form.control} name="temperature" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex justify-between">
                          <span>Temperature</span>
                          <span className="text-muted-foreground font-mono">{field.value.toFixed(1)}</span>
                        </FormLabel>
                        <FormControl>
                          <Slider min={0} max={2} step={0.1}
                            value={[field.value]}
                            onValueChange={(v) => field.onChange(v[0])}
                            className="py-2" />
                        </FormControl>
                        <FormDescription>Higher = more creative. Lower = more focused.</FormDescription>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="maxTokens" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex justify-between">
                          <span>Max Tokens</span>
                          <span className="text-muted-foreground font-mono">{field.value.toLocaleString()}</span>
                        </FormLabel>
                        <FormControl>
                          <Input type="number" {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                            className="font-mono" />
                        </FormControl>
                        <FormDescription>Max length of each response.</FormDescription>
                      </FormItem>
                    )} />
                  </div>
                </div>
              )}

              {/* Tools */}
              {activeTab === "tools" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h3 className="text-xl font-bold mb-1">Tools</h3>
                    <p className="text-sm text-muted-foreground mb-6">Enable or disable agent capabilities.</p>
                  </div>

                  {[
                    {
                      name: "enableCodeExecution" as const,
                      label: "Code Execution",
                      icon: Code2,
                      desc: "Run JavaScript, TypeScript, Python, and Bash in an isolated sandbox.",
                    },
                    {
                      name: "enableWebSearch" as const,
                      label: "Web Search",
                      icon: Globe,
                      desc: "Search the internet for real-time information.",
                    },
                  ].map(({ name, label, icon: Icon, desc }) => (
                    <FormField key={name} control={form.control} name={name} render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border border-border p-4 bg-card/50">
                        <div className="flex items-start gap-3">
                          <Icon className="w-5 h-5 text-primary mt-0.5" />
                          <div>
                            <FormLabel className="text-base">{label}</FormLabel>
                            <FormDescription className="mt-0.5">{desc}</FormDescription>
                          </div>
                        </div>
                        <FormControl>
                          <Switch checked={field.value as boolean} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )} />
                  ))}
                </div>
              )}

              {/* Appearance */}
              {activeTab === "appearance" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h3 className="text-xl font-bold mb-1">Appearance</h3>
                    <p className="text-sm text-muted-foreground mb-6">Customize the look and feel.</p>
                  </div>
                  <FormField control={form.control} name="theme" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Theme</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select theme" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="light"><div className="flex items-center gap-2"><Sun className="w-4 h-4" /> Light</div></SelectItem>
                          <SelectItem value="dark"><div className="flex items-center gap-2"><Moon className="w-4 h-4" /> Dark</div></SelectItem>
                          <SelectItem value="system"><div className="flex items-center gap-2"><MonitorSmartphone className="w-4 h-4" /> System</div></SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>MaxxTech Agent looks best in dark mode.</FormDescription>
                    </FormItem>
                  )} />
                </div>
              )}

              {/* About */}
              {activeTab === "about" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h3 className="text-xl font-bold mb-1">About MaxxTech Agent</h3>
                    <p className="text-sm text-muted-foreground mb-6">Platform information and credits.</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card/50 p-6 space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                        <Zap className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-lg tracking-tight">MaxxTech Agent</p>
                        <p className="text-sm text-muted-foreground">v1.0.0 · Self-hosted AI Platform</p>
                      </div>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-muted-foreground">Developer</span>
                        <span className="font-semibold text-primary">CarlymaxX</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-muted-foreground">AI Providers</span>
                        <span className="font-mono text-xs">Claude · Gemini · OpenRouter</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-muted-foreground">Models Available</span>
                        <span className="font-mono text-xs">12 models</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-muted-foreground">Stack</span>
                        <span className="font-mono text-xs">React · Express · PostgreSQL</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-muted-foreground">Repository</span>
                        <a
                          href="https://github.com/Carlymaxx/maxxtech-agent"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline text-xs font-mono"
                        >
                          github.com/Carlymaxx/maxxtech-agent
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab !== "about" && (
                <div className="pt-6 border-t border-border flex justify-end">
                  <Button
                    type="submit"
                    disabled={updateSettings.isPending}
                    className="min-w-[140px]"
                    data-testid="button-save-settings"
                  >
                    {updateSettings.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              )}
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
