import axios from "axios";
import { getAccessToken } from "../config/auth";

export async function dataverseGet<T>(path: string): Promise<T> {
    const token = await getAccessToken();

    const url = `${process.env.DATAVERSE_URL}/api/data/v9.2/${path}`;

    const response = await axios.get(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json"
        }
    });

    return response.data;
}
