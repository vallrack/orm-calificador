import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { MasterTemplate, StudentExamResult } from "../types";
import { DEFAULT_MASTER_TEMPLATE } from "../data/samplePresets";

export const loadUserData = async (userId: string) => {
  try {
    // Load Templates (new structure)
    const templatesSnapshot = await getDocs(collection(db, "users", userId, "templates"));
    const templates: MasterTemplate[] = [];
    templatesSnapshot.forEach((doc) => {
      templates.push(doc.data() as MasterTemplate);
    });

    // Migration for legacy single template if no templates exist
    if (templates.length === 0) {
      const legacyTemplateDoc = await getDoc(doc(db, "users", userId, "settings", "master_template"));
      if (legacyTemplateDoc.exists()) {
        const legacyTemplate = legacyTemplateDoc.data() as MasterTemplate;
        templates.push(legacyTemplate);
        // Save it to new location immediately
        await saveTemplate(userId, legacyTemplate);
      }
    }

    // Load Results
    const resultsSnapshot = await getDocs(collection(db, "users", userId, "results"));
    const results: StudentExamResult[] = [];
    resultsSnapshot.forEach((doc) => {
      results.push(doc.data() as StudentExamResult);
    });

    return { templates, results };
  } catch (error) {
    console.error("Error loading user data from Firestore:", error);
    return { templates: [], results: [] };
  }
};

export const saveTemplate = async (userId: string, template: MasterTemplate) => {
  try {
    if (!template.id) template.id = Date.now().toString();
    await setDoc(doc(db, "users", userId, "templates", template.id), template);
  } catch (error) {
    console.error("Error saving template to Firestore:", error);
    throw error;
  }
};

export const deleteTemplate = async (userId: string, templateId: string) => {
  try {
    await deleteDoc(doc(db, "users", userId, "templates", templateId));
  } catch (error) {
    console.error("Error deleting template from Firestore:", error);
    throw error;
  }
};

export const saveResult = async (userId: string, result: StudentExamResult) => {
  try {
    // Clone result to avoid mutating the React state
    const resultToSave = { ...result };
    // Remove heavy base64 images to prevent Firestore 1MB document size limit error
    delete resultToSave.imageUrl;
    delete resultToSave.processedImageUrl;
    delete resultToSave.binarizedImageUrl;
    
    await setDoc(doc(db, "users", userId, "results", result.id), resultToSave);
  } catch (error) {
    console.error("Error saving result to Firestore:", error);
  }
};

export const deleteResult = async (userId: string, resultId: string) => {
  try {
    await deleteDoc(doc(db, "users", userId, "results", resultId));
  } catch (error) {
    console.error("Error deleting result from Firestore:", error);
  }
};

export const deleteUserData = async (userId: string, results: StudentExamResult[], templates: MasterTemplate[]) => {
  try {
    const batch = writeBatch(db);
    
    // Delete old legacy template
    batch.delete(doc(db, "users", userId, "settings", "master_template"));

    // Delete all templates
    templates.forEach(t => {
      batch.delete(doc(db, "users", userId, "templates", t.id));
    });
    
    // Delete all results
    results.forEach(result => {
      batch.delete(doc(db, "users", userId, "results", result.id));
    });

    await batch.commit();
  } catch (error) {
    console.error("Error deleting user data from Firestore:", error);
  }
};
