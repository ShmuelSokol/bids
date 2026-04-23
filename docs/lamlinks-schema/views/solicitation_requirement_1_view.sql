-- dbo.solicitation_requirement_1_view



/* view solicitation_requirement_1_view: add view */


/* view solicitation_requirement_1_view: add view */


/* view solicitation_requirement_1_view: add view */

/* view solicitation_requirement_1_view: add view */


/* view solicitation_requirement_1_view: add view */


/* view solicitation_requirement_1_view: add view */


/* view solicitation_requirement_1_view: add view */


/* view solicitation_requirement_1_view: add view */


/* view solicitation_requirement_1_view: add view */


/* view solicitation_requirement_1_view: add view */


/* view solicitation_requirement_1_view: add view */


/* view solicitation_requirement_1_view: add view */


/* view solicitation_requirement_1_view: add view */


/* view solicitation_requirement_1_view: add view */


/* view solicitation_requirement_1_view: add view */


/* view solicitation_requirement_1_view: add view */


/* view solicitation_requirement_1_view: add view */


/* view solicitation_requirement_1_view: add view */
CREATE VIEW [dbo].[solicitation_requirement_1_view]
AS
SELECT     dbo.k10_tab.idnk10_k10, dbo.k12_tab.idnk12_k12, dbo.k12_tab.e_code_k12
FROM         dbo.k10_tab INNER JOIN
                      dbo.k31_tab ON dbo.k10_tab.idnk31_k10 = dbo.k31_tab.idnk31_k31 INNER JOIN
                      dbo.k12_tab ON dbo.k31_tab.idnk12_k31 = dbo.k12_tab.idnk12_k12


















