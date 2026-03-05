
import { useState, useRef } from "react";
import { Link } from "wouter";
import { ArrowLeft, Upload, Search, Save, AlertTriangle, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ScanFrame } from "@/components/ui/scan-frame";
import { MOCK_RESULTS, type Criminal } from "@/lib/mock-data";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

export default function IdentifyPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<Criminal[] | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setResults(null); // Reset results on new upload
    }
  };

  const handleAnalyze = async () => {

  if(!file) return;

  setIsAnalyzing(true);

  const formData = new FormData();
  formData.append("file", file);

  const uploadRes = await fetch("/api/upload",{
    method:"POST",
    body:formData
  });

  const uploadData = await uploadRes.json();

  const resultRes = await fetch("/api/identify",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ path:uploadData.path })
  });

  const data = await resultRes.json();

  setResults(data);

  setIsAnalyzing(false);

};

  const handleSave = (criminal: Criminal) => {
    toast({
      title: "Record Saved",
      description: `Saved profile for ${criminal.name} to local case file.`,
    });
  };

  return (
    <div className="min-h-screen p-4 md:p-8 relative bg-background text-foreground overflow-x-hidden">
      <div className="absolute inset-0 bg-background/95 backdrop-blur-sm fixed z-0" />
      
      {/* Navigation */}
      <div className="relative z-10 mb-8 flex items-center justify-between max-w-7xl mx-auto w-full">
        <Link href="/dashboard">
          <Button variant="ghost" className="text-primary hover:text-primary/80 pl-0">
            <ArrowLeft className="mr-2 h-5 w-5" />
            BACK TO DASHBOARD
          </Button>
        </Link>
        <div className="text-right hidden md:block">
          <h1 className="text-2xl font-display font-bold text-primary">IDENTIFICATION MODULE</h1>
          <p className="text-xs text-muted-foreground font-mono">SECURE CHANNEL // ENCRYPTED</p>
        </div>
      </div>

      <main className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Panel: Input */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="p-6 bg-black/40 border-primary/20 backdrop-blur-md">
            <h2 className="text-xl font-display font-bold text-white mb-4 flex items-center">
              <Upload className="mr-2 h-5 w-5 text-primary" />
              INPUT SOURCE
            </h2>
            
            <div className="space-y-4">
              <div 
                className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors bg-secondary/20 h-[300px] flex flex-col items-center justify-center relative overflow-hidden"
                onClick={() => fileInputRef.current?.click()}
              >
                {preview ? (
                  <img src={preview} alt="Sketch input" className="max-h-full max-w-full object-contain z-10" />
                ) : (
                  <>
                    <ScanLine className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                    <p className="text-sm text-muted-foreground">Click to upload forensic sketch</p>
                    <p className="text-xs text-muted-foreground/50 mt-2">Supports JPG, PNG, BMP</p>
                  </>
                )}
                {isAnalyzing && (
                  <div className="absolute inset-0 z-20 bg-primary/10 flex items-center justify-center">
                    <div className="w-full h-1 bg-primary absolute top-0 animate-[scan_2s_linear_infinite]" />
                    <div className="font-mono text-primary animate-pulse bg-black/50 px-3 py-1 rounded">ANALYZING GEOMETRY...</div>
                  </div>
                )}
              </div>
              
              <Input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange} 
              />

              <Button 
                className="w-full font-display text-lg h-12 tracking-wider" 
                onClick={handleAnalyze} 
                disabled={!file || isAnalyzing}
              >
                {isAnalyzing ? "PROCESSING..." : "RUN IDENTIFICATION"}
                {!isAnalyzing && <Search className="ml-2 h-5 w-5" />}
              </Button>
            </div>
          </Card>

          {/* Console Output (Decorative) */}
          <div className="bg-black border border-primary/20 p-4 rounded-md h-48 overflow-hidden font-mono text-xs text-green-500 opacity-70 hidden lg:block">
            <div className="space-y-1">
              <p>&gt; SYSTEM_READY</p>
              {file && <p>&gt; IMAGE_LOADED: {file.name}</p>}
              {isAnalyzing && (
                <>
                  <p>&gt; EXTRACTING_HOG_FEATURES...</p>
                  <p>&gt; CALCULATING_GEOMETRIC_DISTANCE...</p>
                  <p>&gt; COMPARING_AGAINST_DB_ENTRIES [54,921]...</p>
                  <p>&gt; OPTIMIZING_RESULTS...</p>
                </>
              )}
              {results && <p>&gt; SEARCH_COMPLETE: 5 MATCHES FOUND</p>}
              <span className="animate-pulse">_</span>
            </div>
          </div>
        </div>

        {/* Right Panel: Results */}
        <div className="lg:col-span-7">
          <AnimatePresence>
            {!results && !isAnalyzing && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center p-12 border border-dashed border-muted-foreground/20 rounded-lg"
              >
                <AlertTriangle className="w-16 h-16 text-muted-foreground/20 mb-4" />
                <h3 className="text-2xl font-display text-muted-foreground/50">AWAITING INPUT</h3>
                <p className="text-muted-foreground/40 font-tech">Upload a sketch to begin analysis</p>
              </motion.div>
            )}

            {results && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-display font-bold text-white">TOP 5 MATCHES</h2>
                  <div className="text-xs font-mono text-primary">SORTED BY: CONFIDENCE_SCORE</div>
                </div>

                {/* Rank 1 - Big Display */}
                <div className="bg-gradient-to-r from-primary/10 to-transparent p-1 rounded-lg">
                  <ScanFrame className="bg-black/60 p-6 flex flex-col md:flex-row gap-6 items-center md:items-start">
                    <div className="relative w-48 h-48 md:w-56 md:h-56 shrink-0">
                      <img 
                        src={results[0].imageUrl} 
                        alt="Top Match" 
                        className="w-full h-full object-cover rounded-sm filter contrast-125 sepia-[.2]" 
                      />
                      <div className="absolute top-2 right-2 bg-destructive text-white text-xs font-bold px-2 py-1 rounded-sm animate-pulse">
                        RANK #1
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1 text-center text-primary font-mono text-xl font-bold border-t border-primary">
                        {results[0].matchScore}%
                      </div>
                    </div>

                    <div className="flex-1 w-full space-y-4">
                      <div>
                        <h3 className="text-3xl font-display font-bold text-white tracking-wide">{results[0].name}</h3>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="bg-destructive/20 text-destructive border border-destructive/50 px-2 py-0.5 text-xs rounded-sm uppercase">{results[0].status}</span>
                          <span className="bg-secondary text-secondary-foreground border border-white/10 px-2 py-0.5 text-xs rounded-sm uppercase">{results[0].department}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm font-tech">
                        <div>
                          <span className="text-muted-foreground block text-xs">ID NUMBER</span>
                          <span className="text-white font-mono">{results[0].id}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-xs">AGE</span>
                          <span className="text-white font-mono">{results[0].age}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground block text-xs">CRIMINAL RECORD</span>
                          <span className="text-white text-base">{results[0].crime}</span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <Button onClick={() => handleSave(results[0])} className="w-full md:w-auto bg-primary text-black hover:bg-primary/90 font-bold">
                          <Save className="mr-2 h-4 w-4" />
                          SAVE TO CASE FILE
                        </Button>
                      </div>
                    </div>
                  </ScanFrame>
                </div>

                {/* Ranks 2-5 - Smaller Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {results.slice(1).map((criminal, index) => (
                    <motion.div
                      key={criminal.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="bg-card/40 border-white/10 overflow-hidden hover:border-primary/50 transition-colors">
                        <div className="flex h-24">
                          <div className="w-24 relative shrink-0">
                            <img src={criminal.imageUrl} alt={criminal.name} className="w-full h-full object-cover filter grayscale hover:grayscale-0 transition-all" />
                            <div className="absolute top-0 left-0 bg-black/60 text-white text-[10px] px-1">#{index + 2}</div>
                          </div>
                          <div className="p-3 flex flex-col justify-between flex-1">
                            <div>
                              <div className="flex justify-between items-start">
                                <h4 className="font-display font-bold text-sm text-white truncate pr-2">{criminal.name}</h4>
                                <span className="text-primary font-mono text-xs font-bold">{criminal.matchScore}%</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{criminal.crime}</p>
                            </div>
                            <div className="flex justify-between items-center mt-2">
                              <span className="text-[10px] text-destructive uppercase tracking-wider">{criminal.status}</span>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-primary" onClick={() => handleSave(criminal)}>
                                <Save className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
