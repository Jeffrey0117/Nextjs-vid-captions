import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { createCanvas, loadImage, registerFont, CanvasRenderingContext2D } from 'canvas';

const execAsync = promisify(exec);