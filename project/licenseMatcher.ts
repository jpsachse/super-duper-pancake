import { ICommentAnnotator } from "./commentClassificationTypes";
import { CommentClass, SourceComment } from "./sourceComment";
import Utils from "./utils";

/**
 * Matches licenses listed at https://choosealicense.com/appendix/
 */
export class LicenseMatcher implements ICommentAnnotator {
    private customLicenseRegexp: RegExp;
    private generalLicenseRegexp: RegExp;

    public annotate(comment: SourceComment) {
        const text = comment.getSanitizedCommentText().text;
        const specificMatches = text.match(this.getOrBuildCustomLicenseRegexp());
        const generalMatches = text.match(this.getOrBuildGeneralLicenseRegexp());
        const isLicenseText = generalMatches !== null &&
            (specificMatches !== null && specificMatches.length > 0 && generalMatches.length >= 0 ||
                generalMatches.length > 1);
        if (isLicenseText) {
            comment.classifications.push({commentClass: CommentClass.Copyright});
        }
    }

    private getOrBuildCustomLicenseRegexp(): RegExp {
        if (this.customLicenseRegexp === null || this.customLicenseRegexp === undefined) {
            const regexpText = this.getAllCustomLicenseParts().join("|");
            this.customLicenseRegexp = new RegExp(regexpText, "gi");
        }
        return this.customLicenseRegexp;
    }

    private getOrBuildGeneralLicenseRegexp(): RegExp {
        if (this.generalLicenseRegexp === null || this.generalLicenseRegexp === undefined) {
            const regexpText = this.getGeneralLicenseText();
            this.generalLicenseRegexp = new RegExp(regexpText, "gi");
        }
        return this.generalLicenseRegexp;
    }

    private getAllCustomLicenseParts(): string[] {
        let licenseFunctions = Object.getOwnPropertyNames(Object.getPrototypeOf(this));
        const functionNameRegexp = /^get[a-zA-Z]+Part$/;
        licenseFunctions = licenseFunctions.filter((name) => {
            return name.search(functionNameRegexp) >= 0;
        });
        const result: string[] = [];
        licenseFunctions.forEach((functionName) => {
            const functionObject = this[functionName];
            if (typeof functionObject === "function") {
                result.push(functionObject());
            }
        });
        return result;
    }

    private getGeneralLicenseText(): string {
        return "[\\s-]licen[sc]e[\\s-]|copyright|copyleft|\\(c\\)|provided \\\"as is\\\"";
    }

    private getMITPart(): string {
        return "\\sMIT[\\s-]|Massachusetts Institute of Technology";
    }

    private getAFLPart(): string {
        return "Academic Free|AFL";
    }

    private getAfferoPart(): string {
        return "AFFERO GENERAL PUBLIC|AGPL";
    }

    private getApachePart(): string {
        return "Apache|Apache\\s\*2";
    }

    private getArtisticPart(): string {
        return "Artistic";
    }

    private getBSDPart(): string {
        return "BSD|[23]-clause";
    }

    private getBoostPart(): string {
        return "boost software";
    }

    private getCCPart(): string {
        const nameVersion = "Attribution([\\s-](Sharealike|NoDerivs|NonCommercial))*[\\s-]*[1-9]+\\.[0-9]";
        const shortNames = "CC BY([\\s-](SA|ND|NC))*";
        return "creative commons|" + shortNames + "|" + nameVersion;
    }

}
