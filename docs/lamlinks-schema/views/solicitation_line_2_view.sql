-- dbo.solicitation_line_2_view



/* view solicitation_line_2_view: add view */


/* view solicitation_line_2_view: add view */


/* view solicitation_line_2_view: add view */

/* view solicitation_line_2_view: add view */


/* view solicitation_line_2_view: add view */


/* view solicitation_line_2_view: add view */


/* view solicitation_line_2_view: add view */


/* view solicitation_line_2_view: add view */


/* view solicitation_line_2_view: add view */


/* view solicitation_line_2_view: add view */


/* view solicitation_line_2_view: add view */


/* view solicitation_line_2_view: add view */


/* view solicitation_line_2_view: add view */


/* view solicitation_line_2_view: add view */


/* view solicitation_line_2_view: add view */


/* view solicitation_line_2_view: add view */


/* view solicitation_line_2_view: add view */


/* view solicitation_line_2_view: add view */
CREATE VIEW [dbo].[solicitation_line_2_view]
AS
SELECT     dbo.solicitation_line_1_view.partno_k08, dbo.solicitation_line_1_view.p_cage_k08, dbo.solicitation_line_1_view.p_desc_k08, dbo.solicitation_line_1_view.fsc_k08, 
                      dbo.solicitation_line_1_view.niin_k08
FROM         dbo.solicitation_requirement_1_view INNER JOIN
                      dbo.solicitation_line_1_view ON dbo.solicitation_requirement_1_view.idnk10_k10 = dbo.solicitation_line_1_view.idnk10_k10


















