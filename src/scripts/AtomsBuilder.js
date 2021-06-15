import Stats from 'stats.js';
import {Scene, PerspectiveCamera, WebGLRenderer, PCFSoftShadowMap, sRGBEncoding, AmbientLight, HemisphereLight, AxesHelper, BoxGeometry, BoxHelper, Mesh, MeshBasicMaterial, EventDispatcher, Vector2, Raycaster, Vector3} from "three"
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import { Molecule, BOUNDS, NORMALSIZE, EVENT_COLLISION, EVENT_DESTROYED } from "./Atom";

export class MoleculesCollider extends EventDispatcher {
    constructor(){
        super();
        this.__collidables = [];
        this.__aRigidMolecule = null;
    }

    update(){
        let i;
        for (i=0;i<this.__collidables.length;i++){
            let molecule = this.__collidables[i];
            let hitWith = molecule.checkCollision(this.__collidables);
            if(hitWith){
                this.dispatchEvent({type: EVENT_COLLISION, target: this, hitBy: molecule, hitWith: hitWith});
                return;
            }
        }
    }

    addCollidable(molecule){
        this.__collidables.push(molecule);
    }

    removeMolecule(molecule){
        let index = this.__collidables.indexOf(molecule);
        if(index > -1){
            this.__collidables.splice(index, 1);
        }
    }
}

export class AtomsScene extends Scene {
    constructor(elementID){
        super();
        this.__domID = (elementID) ? elementID : "atoms-scene";
        this.__domElement = document.getElementById(this.__domID);
        this.__domInfoId = null;
        this.__domInfoElement = null;

        if(!this.__domElement){
            this.__domElement = document.createElement("DIV");
            this.__domElement.setAttribute("id", this.__domID);
            document.getElementsByTagName('BODY')[0].append(this.__domElement);
        }

        this.__prevTime = 0;
        this.__collidables = new MoleculesCollider();

        this.__camera = null;
        this.__renderer = null;
        this.__controls = null;
        this.__ambientLight = null;
        this.__hemisphereLight = null;
        this.__renderScene = true;

        this.__hitWithMolecule = null;
        this.__hitByMolecule = null;

        this.__destroyMoleculeEvent = this.__destroyMolecule.bind(this);

        this.__molecules = [];

        this.__stats = new Stats();
        document.body.appendChild(this.__stats.dom);

        this.__initialize();
        this.__addMoleculesToScene();

        this.__collidables.addEventListener(EVENT_COLLISION, this.__stopRender.bind(this));
        window.addEventListener('click', this.__addMoleculeWithClick.bind(this));
        window.addEventListener('touchstart', this.__addMoleculeWithClick.bind(this));
        window.addEventListener('contextmenu', this.__destroyMoleculeWithDoubleClick.bind(this));
        window.addEventListener('mousemove', this.__infoWindow.bind(this));
    }

    __infoWindow(evt){
        if(!this.__domInfoElement){
            return;
        }
        let atom = null, molecule = null;
        let intersectResults = null;
        let size = this.__getSize();
        let raycaster = new Raycaster();
        let mouse = new Vector3(0, 0, 0.5);
        let message = null;
        let valence = 'N/A';
        mouse.x = ((evt.clientX / size.x) * 2) - 1;
        mouse.y = (-(evt.clientY / size.y) * 2) + 1;
        raycaster.setFromCamera(mouse, this.__camera);
        intersectResults = raycaster.intersectObjects(this.__molecules, true);
        if(intersectResults.length){
            atom= intersectResults[0].object;
            molecule = atom.parent.parent;
            valence = molecule.valence;            
        }
        message = `Valence: ${valence}`;
        this.__domInfoElement.innerHTML = message;
    }

    __stopRender(evt){       
        this.__hitByMolecule = evt.hitBy;
        this.__hitWithMolecule = evt.hitWith; 
        // this.__renderScene = false;
    }

    __addNewMoleculeWithOneAtom(x, y, z){
        let molecule = new Molecule();
        molecule.addAtom();
        molecule.position.set(x, y, z);
        this.__molecules.push(molecule);
        this.__collidables.addCollidable(molecule);
        this.add(molecule);
        molecule.addEventListener(EVENT_DESTROYED, this.__destroyMoleculeEvent);
    }
    __addMoleculeWithClick(evt){
        console.log(evt.touches);
        if(evt.touches){
            if(evt.touches.length > 1){
                this.__destroyMoleculeWithDoubleClick(evt.touches[0]);
                return;
            }            
            evt = evt.touches[0];
        }
        let p = null;
        let intersectResults = null;
        let size = this.__getSize();
        let raycaster = new Raycaster();
        let mouse = new Vector3(0, 0, 0.5);
        mouse.x = ((evt.clientX / size.x) * 2) - 1;
        mouse.y = (-(evt.clientY / size.y) * 2) + 1;
        raycaster.setFromCamera(mouse, this.__camera);
        intersectResults = raycaster.intersectObject(this.__hitBox);
        if(intersectResults.length){
            p = intersectResults[0].point;
            intersectResults = raycaster.intersectObjects(this.__molecules, true);
            if(intersectResults.length){
                let addCell=null, direction=null;
                let atom= intersectResults[0].object, molecule=null;
                let newAtom=null;
                direction = atom.getAlignedDirection(intersectResults[0].face.normal.clone());
                molecule = atom.parent.parent;                
                addCell = atom.cell.clone().add(intersectResults[0].face.normal.clone());
                newAtom = molecule.addAtom(addCell.y, addCell.x, addCell.z, direction);
                newAtom.alignment = newAtom.alignment.clone().multiply(atom.alignment);
                console.log('NORMAL ::', intersectResults[0].face.normal, ', ACTUAL DIRECTION :: ', direction, );
            }   
            else{
                this.__addNewMoleculeWithOneAtom(p.x, p.y, p.z);
            }
            
        }        
        evt.preventDefault();
    }

    __addMoleculesToScene(){
        for (let i =0;i<1;i++){
            let x = (Math.random() * (BOUNDS.x * 2) ) - BOUNDS.x;
            let y = (Math.random() * (BOUNDS.y * 2) ) - BOUNDS.y;
            let z = (Math.random() * (BOUNDS.z * 2) ) - BOUNDS.z;
            this.__addNewMoleculeWithOneAtom(x, y, z);
        }
    }

    __destroyMoleculeWithDoubleClick(evt){
        let size = this.__getSize();
        let raycaster = new Raycaster();
        let mouse = new Vector3(0, 0, 0.5);
        let intersectResults = null;
        mouse.x = ((evt.clientX / size.x) * 2) - 1;
        mouse.y = (-(evt.clientY / size.y) * 2) + 1;
        raycaster.setFromCamera(mouse, this.__camera);
        intersectResults = raycaster.intersectObjects(this.__molecules, true);
        if(intersectResults.length){
            let atom = intersectResults[0].object;
            let molecule = atom.parent.parent;
            molecule.destroy();
            console.log(molecule);
        }
        evt.preventDefault();
    }

    __destroyMolecule(evt){
        let index = this.__molecules.indexOf(evt.target);        
        evt.target.removeEventListener(EVENT_DESTROYED, this.__destroyMoleculeEvent);
        evt.target.clear();
        evt.target.removeFromParent();
        this.__collidables.removeMolecule(evt.target);
        if(index > -1){
            this.__molecules.splice(index, 1);
        }
    }

    
    __initialize(){
        let cameraNear = 1;
        let cameraFar = 10000;
        this.__camera = new PerspectiveCamera(45, 10, cameraNear, cameraFar);
        this.__renderer = this.__getRenderer();
        this.__axes = new AxesHelper(BOUNDS.x);
        this.__controls = new OrbitControls(this.__camera, this.__domElement);
        this.__controls.enableDamping = true;
        this.__controls.dampingFactor = 0.1;
        this.__controls.minDistance = 4;
        this.__controls.screenSpacePanning = true;

        const box = new BoxGeometry(BOUNDS.x*2, BOUNDS.y*2, BOUNDS.z*2, 1, 1, 1);
        const boxMesh = new Mesh( box, new MeshBasicMaterial( {color: 0xFF0000, visible: false} ) );
        this.__boundsBox = new BoxHelper(boxMesh, 0xFF0000);
        this.__hitBox = boxMesh;
        
        this.__camera.position.set(0, 50, 50);
        this.__controls.update();

        this.add(this.__axes);
        this.add(this.__boundsBox);
        this.add(this.__hitBox);

        this.__addLights();
        this.__domElement.appendChild(this.__renderer.domElement);
        this.__renderer.setAnimationLoop(this.__render.bind(this));

        window.addEventListener('resize', this.__updateSize.bind(this));
        window.addEventListener('orientationchange', this.__updateSize.bind(this));

        this.__updateSize();
    }

    __addLights(){
        let hemiLight = new HemisphereLight(0xFFFFFF, 0x999999, 0.75);
        let ambiLight = new AmbientLight(0x515151);

        ambiLight.intensity = 0.75;
        hemiLight.position.set(0, 1000, 0);

        this.__hemisphereLight = hemiLight;
        this.__ambientLight = ambiLight;

        this.add(hemiLight);
        this.add(ambiLight);
    }

    __getRenderer(){
        let renderer = new WebGLRenderer({antialias: true, alpha: false});
        renderer.shadowMap.enabled = false;
        renderer.shadowMapSoft = true;
        renderer.shadowMap.type = PCFSoftShadowMap;
        renderer.setClearColor(0xFFFFFF, 1);
        renderer.outputEncoding = sRGBEncoding;
        renderer.setPixelRatio(window.devicePixelRatio);
        return renderer;
    }

    __getSize(){
        let heightMargin = this.__domElement.offsetTop;
        let widthMargin = this.__domElement.offsetLeft;
        let elementWidth = window.innerWidth - widthMargin;
        let elementHeight = window.innerHeight - heightMargin;

        return new Vector2(elementWidth, elementHeight);
    }

    __updateSize(){
        
        let size = this.__getSize();
        this.__camera.aspect = size.x / size.y;
        this.__camera.updateProjectionMatrix();
        this.__renderer.setSize(size.x, size.y);
    }

    __render(time){
        let delta = (time - this.__prevTime) / 1000.0;
        this.__stats.begin();
        this.__prevTime = time;
        if(!this.__renderScene){
            this.__hitWithMolecule.pulse(delta);
            this.__hitByMolecule.pulse(delta);
            this.__controls.update();
            this.__renderer.render(this, this.__camera);            
        }
        else{
            this.__molecules.forEach((molecule)=>{
                molecule.update(delta);
            });
            this.__collidables.update();
            this.__controls.update();
            this.__renderer.render(this, this.__camera);        
        }
        this.__stats.end();
    }

    get domInfoId(){
        return this.__domInfoId;
    }

    set domInfoId(id){
        this.__domInfoId = id;
        this.__domInfoElement = document.getElementById(id);
    }
}