-- dbo.credential_control_3_view



/* view credential_control_3_view: add view */


/* view credential_control_3_view: add view */


/* view credential_control_3_view: add view */

/* view credential_control_3_view: add view */


/* view credential_control_3_view: add view */


/* view credential_control_3_view: add view */


/* view credential_control_3_view: add view */
CREATE VIEW [dbo].[credential_control_3_view]
AS
SELECT        dbo.aka_cage_1_view.e_code_aka, dbo.aka_cage_1_view.e_name_aka, dbo.aka_cage_1_view.idnk12_aka, dbo.credential_control_1_view.c_stat_kdg, dbo.credential_control_1_view.efftme_kdg, 
                         dbo.credential_control_1_view.athsys_kdf, dbo.credential_control_1_view.athtyp_kdf, dbo.aka_cage_1_view.idnkdg_kdg
FROM            dbo.aka_cage_1_view LEFT OUTER JOIN
                         dbo.credential_control_1_view ON dbo.aka_cage_1_view.idnk12_aka = dbo.credential_control_1_view.idntoa_kdg AND dbo.credential_control_1_view.tbltoa_kdg = 'k12'







