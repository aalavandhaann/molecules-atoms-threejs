import { AnimationMixer, Box3, Box3Helper, BoxGeometry, Euler, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader";

export const ATOMSIZE = 4;
export const NORMALSIZE = 1;
export const BOUNDS = new Vector3(20, 20, 20);
export const EVENT_DESTROYED = 'DESTROYED_EVENT';
export const EVENT_COLLISION = 'COLLISION_EVENT';

export class CollisionResult{
    constructor(atomA, atomB){
        let xAD = atomA.wxSA.clone().sub(atomB.wxSA).length();
        let xBD = atomA.wxSA.clone().sub(atomB.wxSB).length();
        
        let yAD = atomA.wySA.clone().sub(atomB.wySA).length();
        let yBD = atomA.wySB.clone().sub(atomB.wySB).length();

        let zAD = atomA.wzSA.clone().sub(atomB.wzSA).length();
        let zBD = atomA.wzSB.clone().sub(atomB.wzSB).length();

        let distances = [xAD, xBD, yAD, yBD, zAD, zBD];
        let directions = [atomA.xA, atomA.xB, atomA.yA, atomA.yB, atomA.zA, atomA.zB];

        let minIndex = distances.indexOf(Math.min(...distances));

        this.__direction = directions[minIndex];
        this.__distance = distances[minIndex];
        this.__atomA = atomA;
        this.__atomB = atomB;        
    }

    get atomA(){
        return this.__atomA;
    }

    get atomB(){
        return this.__atomB;
    }

    get direction(){
        return this.__direction;
    }

    get distance(){
        return this.__distance;
    }
}

export class AnimatedAtom extends Mesh{
    constructor(){
        super();
        this.__modelURL = './Atom-Animated.glb';
        this.__content = null;
        this.__mixer = null;
        this.__clips = null;
        this.__gltfLoader = new GLTFLoader();        
        this.__initialize();
    }

    __initialize(){
        this.__gltfLoader.load(this.__modelURL, this.__loaded.bind(this));
    }

    __loaded(gltf){
        const scene = gltf.scene || gtlf.scenes[0];
        const clips = gltf.animations || [];
        this.__content = scene;        
        this.__setClips(clips);
        this.add(this.__content);
    }

    __setClips(clips){
        // let morphMeshes = [];
        this.__clips = clips;
        this.__mixer = new AnimationMixer(this.__content);
        this.__clips.forEach((clip, _)=>{
            let action = this.__mixer.clipAction(clip);
            action.play();
        });
    }

    animate(delta){
        if(this.__mixer){
            this.__mixer.update(delta);
        }
    }
}


export class Atom extends Mesh{
    constructor(row, column, depth){
        super();

        this.__atomSize = ATOMSIZE;
        this.__normalSize = NORMALSIZE;
        this.__row = (row) ? row: 0;
        this.__column = (column) ? column: 0;
        this.__depth = (depth) ? depth: 0;
        this.__cell = new Vector3(this.__column, this.__row, this.__depth);
        this.__alignment = new Quaternion();

        this.__xA = new Vector3(this.__normalSize, 0, 0);
        this.__xB = new Vector3(-this.__normalSize, 0, 0);

        this.__yA = new Vector3(0, this.__normalSize, 0);
        this.__yB = new Vector3(0, -this.__normalSize, 0);

        this.__zA = new Vector3(0, 0, this.__normalSize);
        this.__zB = new Vector3(0, 0, -this.__normalSize);

        this.__gltfHolder = null;            
        this.__initialize();
    }

    __initialize(){        
        this.__gltfHolder = new AnimatedAtom();
        this.add(this.__gltfHolder);
        this.geometry = new BoxGeometry(ATOMSIZE*1.1, ATOMSIZE*1.1, ATOMSIZE*1.1);
        this.material = new MeshBasicMaterial({color: 0xFF0000, transparent: true, opacity: 0.5, visible: false});
        this.geometry.computeBoundingBox();
        this.__updatePosition();
    }

    __updatePosition(){
        let x = this.__atomSize * this.__column;
        let y = this.__atomSize * this.__row;
        let z = this.__atomSize * this.__depth;
        this.position.set(x, y, z);
    }

    __addVToPosition(v){
        return this.position.clone().add(v);
    }

    __getWorldLocation(vector, asVector=true){
        let p;
        let pplusv = this.__addVToPosition(vector).applyMatrix4(this.matrixWorld);
        if(asVector){
            p = this.position.clone().applyMatrix4(this.matrixWorld);
            let v = pplusv.clone().sub(p);
            return v;
        }
        return pplusv;
    }

    __updateAlignment(){
        let quat = this.__alignment;
        this.__gltfHolder.setRotationFromQuaternion(quat);
        console.log('EULER ::: ', new Euler().setFromQuaternion(quat));

        this.__xA = this.__xA.applyQuaternion(quat);
        this.__xB = this.__xB.applyQuaternion(quat);

        this.__yA = this.__yA.applyQuaternion(quat);
        this.__yB = this.__yB.applyQuaternion(quat);

        this.__zA = this.__zA.applyQuaternion(quat);
        this.__zB = this.__zB.applyQuaternion(quat);
    }

    alignToDirection(direction){
        let negateDirection = direction.clone().negate();
        /**
         * Singularities are good only in sci-fi novels or movies.
         * In real life they are better to be avoided.
         */
        let quat = new Quaternion().setFromUnitVectors(direction, negateDirection);
        quat = quat.multiply(this.__alignment);        
        this.__alignment = quat.clone();
        this.__updateAlignment();
    }

    getAlignedDirection(direction){
        return direction.applyQuaternion(this.__alignment);
    }

    update(delta){
        // this.__gltfHolder.animate(delta);
    }

    pulse(delta){
        this.__gltfHolder.animate(delta);
    }

    get alignment(){
        return this.__alignment;        
    }

    set alignment(quat){
        this.__alignment = quat;
        this.__updateAlignment();
    }

    get cell(){
        return this.__cell;
    }

    get row(){
        return this.__row;
    }

    set row(value){
        if(Number.isInteger(value)){
            throw new Error("Expected an integer for row");
        }
        this.__row = value;
        this.__cell = new Vector3(this.__column, this.__row, this.__depth);
        this.__updatePosition();
    }

    get column(){
        return this.__column;
    }

    set column(value){
        if(Number.isInteger(value)){
            throw new Error("Expected an integer for column");
        }
        this.__column = value;
        this.__cell = new Vector3(this.__column, this.__row, this.__depth);
        this.__updatePosition();
    }

    get depth(){
        return this.__depth;
    }

    set depth(value){
        if(Number.isInteger(value)){
            throw new Error("Expected an integer for depth");
        }
        this.__depth = value;
        this.__cell = new Vector3(this.__column, this.__row, this.__depth);
        this.__updatePosition();
    }

    /**
     * Get the 6 normals direction of the cube
     */
    get xA(){
        return this.__xA;
    }
    get xB(){
        return this.__xB;
    }

    get yA(){
        return this.__yA;
    }
    get yB(){
        return this.__yB;
    }

    get zA(){
        return this.__zA;
    }
    get zB(){
        return this.__zB;
    }

    /**
     * Get the 6 normals direction of the cube but in world space
     */
    get wxA(){
        return this.__getWorldLocation(this.xA);
    }

    get wxB(){
        return this.__getWorldLocation(this.xB);
    }

    get wyA(){
        return this.__getWorldLocation(this.yA);
    }

    get wyB(){
        return this.__getWorldLocation(this.yB);
    }

    get wzA(){
        return this.__getWorldLocation(this.zA);
    }

    get wzB(){
        return this.__getWorldLocation(this.zB);
    }

    /**
     * Get the 6 surface points of the cube but in world space
     */
    get wxSA(){
        return this.__getWorldLocation(this.xA, false);
    }

    get wxSB(){
        return this.__getWorldLocation(this.xB, false);
    }

    get wySA(){
        return this.__getWorldLocation(this.yA, false);
    }

    get wySB(){
        return this.__getWorldLocation(this.yB, false);
    }

    get wzSA(){
        return this.__getWorldLocation(this.zA, false);
    }

    get wzSB(){
        return this.__getWorldLocation(this.zB, false);
    }
}

export class Molecule extends Mesh{
    constructor(){
        super();        

        this.__render = true;
        this.__speed = this.__newSpeed(0.25, 0.75, 0.1);
        this.__rotationSpeed = this.__newSpeed(0.25, 0.75, 0.01);

        this.__direction = new Vector3(
            (Math.round(Math.random())) ? 1 : -1, 
            (Math.round(Math.random())) ? 1 : -1, 
            (Math.round(Math.random())) ? 1 : -1
            );

        this.__bounds = BOUNDS.clone();//new Vector3(10, 10, 10);
        this.__atoms = [];
        this.__atomsGrid = new Mesh();
        this.add(this.__atomsGrid);
    }

    __newSpeed(minV=0.25, maxV=0.75, factor=0.01){
        let ranSpeedX = (minV + (Math.random() * maxV))*factor;
        let ranSpeedY = (minV + (Math.random() * maxV))*factor;
        let ranSpeedZ = (minV + (Math.random() * maxV))*factor;
        return new Vector3(ranSpeedX, ranSpeedY, ranSpeedZ);
    }

    __updateVectors(){
        if((this.position.x > this.__bounds.x) || (this.position.x < -this.__bounds.x)
        && (this.position.y > this.__bounds.y) || (this.position.y < -this.__bounds.y)
        && (this.position.z > this.__bounds.z) || (this.position.z < -this.__bounds.z)){
            this.__speed = this.__newSpeed(0.25, 0.75, 0.1);
        }
        this.__direction.x = (this.position.x > this.__bounds.x) ? -1: (this.position.x < -this.__bounds.x)? 1 : this.__direction.x;
        this.__direction.y = (this.position.y > this.__bounds.y) ? -1: (this.position.y < -this.__bounds.y)? 1 : this.__direction.y;
        this.__direction.z = (this.position.z > this.__bounds.z) ? -1: (this.position.z < -this.__bounds.z)? 1 : this.__direction.z;
    }

    __collisionStatus(molecule){  
        let box, box2, boxDistance;
        let i;      
        let otherFirstAtom;
        let distances=[], collisionResults=[], minIndex, atomResult, addCell, newAtom=null;
        /**
         * How can a molecule attract to itself?
         */
        if(molecule === this){
            return false;
        }
        /**
         * A molecule with more atoms has a bigger gravity to attract
         */
        if(molecule.atoms.length > this.atoms.length){
            return false;
        }
        /**
         * Purely an implementation problem. Realistically
         * Molecules with > 1 atoms in them can attract to each other.
         * However the way the combine the molecules together without 
         * intersecting with each other is an algorithm by itself. 
         * So keeping the situation simplistic
         */
        if(molecule.atoms.length > 1 && this.atoms.length > 1){
            return false;
        }
        /**
         * Need to use boxes because a molecule could be of any size
         */
        box = new Box3().setFromObject(this);
        if(!box.containsPoint(molecule.position)){
            return false;
        }
        box2 = new Box3().setFromObject(molecule);
        boxDistance = box.getCenter(new Vector3()).clone().sub(box2.getCenter(new Vector3())).length();

        if(boxDistance > (ATOMSIZE * this.__atoms.length * 0.5)){
            return false;
        }

        otherFirstAtom = molecule.atoms[0];
        for (i = 0;i<this.__atoms.length;i++){
            let atom = this.__atoms[i];
            let collisionResult = new CollisionResult(atom, otherFirstAtom);
            distances.push(collisionResult.distance);
            collisionResults.push(collisionResult);
        }

        minIndex = distances.indexOf(Math.min(...distances));
        atomResult = collisionResults[minIndex];
        addCell = atomResult.atomA.cell.clone().add(atomResult.direction);
        newAtom = this.addAtom(addCell.y, addCell.x, addCell.z, atomResult.direction);
        molecule.destroy();
        newAtom.alignment = newAtom.alignment.clone().multiply(atomResult.atomA.alignment);
        return true;
    }

    checkCollision(molecules){
        let i;
        for (i=0;i<molecules.length;i++){
            let flag = this.__collisionStatus(molecules[i]);
            if(flag){
                return molecules[i];
            }
        }
        return null;
    }

    addAtom(row, column, depth, alignDirection){        
        let atom = new Atom(row, column, depth);
        this.__atomsGrid.add(atom); 
        this.__atoms.push(atom);
        if(alignDirection){
            atom.alignToDirection(alignDirection);
        }
        return atom;
    }


    update(delta){
        if(!this.__render){
            return;
        }
        let increment = this.__speed.clone().multiply(this.__direction);
        this.position.add(increment);
        this.__updateVectors();
        this.__atomsGrid.rotation.x += this.__rotationSpeed.x;
        this.__atomsGrid.rotation.y += this.__rotationSpeed.y;
        this.__atoms.forEach((atom)=>{
            atom.update(delta);
        });
    }

    pulse(delta){
        this.__atoms.forEach((atom)=>{
            atom.pulse(delta);
        });
    }

    destroy(){
        this.dispatchEvent({type:EVENT_DESTROYED});
    }

    get atoms(){
        return this.__atoms;
    }

    get bounds(){
        return this.__bounds;
    }

    set bounds(bounds){
        this.__bounds = bounds.clone();
    }

    get render(){
        return this.__render;
    }

    set render(flag){
        this.__render = flag;
    }
}