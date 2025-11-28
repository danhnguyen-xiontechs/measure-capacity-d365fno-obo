import { Router } from "express";
import { dataverseGet } from "../services/dataverseService";

const router = Router();

router.get("/", async (req, res) => {
    try {
        const data = await dataverseGet<any>("");

        const mapped = data.value.map((acc: any) => ({
            id: acc.accountid,
            name: acc.name,
            number: acc.accountnumber
        }));

        res.json(mapped);
    } catch (error: any) {
        console.error(error.response?.data || error);
        res.status(500).json({ error: "Failed to fetch accounts" });
    }
});

export default router;
