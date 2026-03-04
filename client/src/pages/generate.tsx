import { useEffect, useRef } from "react";
import * as fabric from "fabric";

export default function GeneratePage() {

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvas = useRef<fabric.Canvas | null>(null);

  useEffect(() => {

  fabricCanvas.current = new fabric.Canvas(canvasRef.current!, {
    width: 600,
    height: 600,
    backgroundColor: "#eeeeee"
  });

  // Add base face shape automatically
  fabric.Image.fromURL(
    "/project/module1_face_comp/assets/face_shape/face1.png",
    (img) => {

      img.set({
        left: 100,
        top: 80,
        selectable: false
      });

      img.scaleToWidth(400);

      fabricCanvas.current?.add(img);

    }
  );

}, []);

  const addPart = (src: string) => {

    fabric.Image.fromURL(src, (img) => {

      img.set({
        left: 250,
        top: 250,
        scaleX: 0.5,
        scaleY: 0.5,
        selectable: true
      });

      fabricCanvas.current?.add(img);

    });
  };

  const bringForward = () => {
    const obj = fabricCanvas.current?.getActiveObject();
    if(obj) fabricCanvas.current?.bringForward(obj);
  };

  const sendBackward = () => {
    const obj = fabricCanvas.current?.getActiveObject();
    if(obj) fabricCanvas.current?.sendBackwards(obj);
  };

  const deleteSelected = () => {
    const obj = fabricCanvas.current?.getActiveObject();
    if(obj) fabricCanvas.current?.remove(obj);
  };

  const download = () => {
    const dataURL = fabricCanvas.current?.toDataURL({
      format: "png"
    });

    const link = document.createElement("a");
    link.href = dataURL!;
    link.download = "sketch.png";
    link.click();
  };

  return (

    <div style={{display:"flex", height:"100vh"}}>

      {/* LEFT PANEL */}
      <div style={{width:"250px", overflow:"scroll", background:"#6a00a8", padding:"10px"}}>

        <h3 style={{color:"white"}}>Eyes</h3>

        <img
          src="/project/module1_face_comp/assets/eyes/eye1.png"
          width="80"
          onClick={()=>addPart("/project/module1_face_comp/assets/eyes/eye1.png")}
        />

        <img
          src="/project/module1_face_comp/assets/eyes/eye2.png"
          width="80"
          onClick={()=>addPart("/project/module1_face_comp/assets/eyes/eye2.png")}
        />

        <h3 style={{color:"white"}}>Nose</h3>

        <img
          src="/project/module1_face_comp/assets/nose/nose1.png"
          width="80"
          onClick={()=>addPart("/project/module1_face_comp/assets/nose/nose1.png")}
        />

      </div>


      {/* CANVAS */}

      <div style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center"}}>

        <canvas ref={canvasRef}/>

        <div style={{marginTop:"20px"}}>

          <button onClick={bringForward}>Bring Forward</button>
          <button onClick={sendBackward}>Send Backward</button>
          <button onClick={deleteSelected}>Delete</button>
          <button onClick={download}>Download Sketch</button>

        </div>

      </div>

    </div>

  );
}