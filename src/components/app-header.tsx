export function AppHeader() {
  return (
    <header className="fixed top-0 w-full z-50 bg-background border-b border-border/20 flex items-center px-6 py-4">
      <div className="flex flex-col">
        <h1 className="text-primary font-headline font-black italic tracking-tighter text-xl leading-none">
          TriTrainer
        </h1>
        <p className="text-[10px] text-muted-foreground font-medium tracking-wide">
          Your journey to the finish line
        </p>
      </div>
    </header>
  );
}
