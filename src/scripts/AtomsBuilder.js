import Stats from 'stats.js';
import {Scene, PerspectiveCamera, WebGLRenderer, PCFSoftShadowMap, sRGBEncoding, AmbientLight, HemisphereLight, AxesHelper, BoxGeometry, BoxHelper, Mesh, MeshBasicMaterial, EventDispatcher} from "three"
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import { Molecule, BOUNDS, EVENT_COLLISION, EVENT_DESTROYED } from "./Atom";

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
}

export class AtomsScene extends Scene {
    constructor(elementID){
        super();
        this.__domID = (elementID) ? elementID : "atoms-scene";
        this.__domElement = document.getElementById(this.__domID);

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
        this.__addMoleculeToScene();

        this.__collidables.addEventListener(EVENT_COLLISION, this.__stopRender.bind(this));
    }

    __stopRender(evt){       
        this.__hitByMolecule = evt.hitBy;
        this.__hitWithMolecule = evt.hitWith; 
        // this.__renderScene = false;
    }

    __addMoleculeToScene(){
        for (let i =0;i<50;i++){
            let x = (Math.random() * (BOUNDS.x * 2) ) - BOUNDS.x;
            let y = (Math.random() * (BOUNDS.y * 2) ) - BOUNDS.x;
            let z = (Math.random() * (BOUNDS.z * 2) ) - BOUNDS.x;

            let molecule = new Molecule();
            molecule.addAtom();
            molecule.position.set(x, y, z);
            molecule.addEventListener(EVENT_DESTROYED, this.__destroyMoleculeEvent);
            this.__molecules.push(molecule);
            this.add(molecule);
            this.__collidables.addCollidable(molecule);
        }
    }

    __destroyMolecule(evt){
        let index = this.__molecules.indexOf(evt.target);        
        evt.target.removeEventListener(EVENT_DESTROYED, this.__destroyMoleculeEvent);
        evt.target.clear();
        evt.target.removeFromParent();
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
        const boxMesh = new Mesh( box, new MeshBasicMaterial( 0xFF0000 ) );
        this.__boundsBox = new BoxHelper(boxMesh, 0xFF0000);
        
        this.__camera.position.set(0, 50, 50);
        this.__controls.update();

        this.add(this.__axes);
        this.add(this.__boundsBox);

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

    __updateSize(){
        let heightMargin = this.__domElement.offsetTop;
        let widthMargin = this.__domElement.offsetLeft;
        let elementWidth = window.innerWidth - widthMargin;
        let elementHeight = window.innerHeight - heightMargin;

        this.__camera.aspect = elementWidth / elementHeight;
        this.__camera.updateProjectionMatrix();
        this.__renderer.setSize(elementWidth, elementHeight);
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
}