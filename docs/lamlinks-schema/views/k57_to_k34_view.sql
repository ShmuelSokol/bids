-- dbo.k57_to_k34_view



/* view k57_to_k34_view: add view */


/* view k57_to_k34_view: add view */


/* view k57_to_k34_view: add view */
CREATE VIEW dbo.k57_to_k34_view
AS
SELECT        dbo.k57_to_k43_view.idnk57_k57, dbo.k43_to_k34_view.idnk43_k43, dbo.k43_to_k34_view.idnk34_k34
FROM            dbo.k43_to_k34_view INNER JOIN
                         dbo.k57_to_k43_view ON dbo.k43_to_k34_view.idnk43_k43 = dbo.k57_to_k43_view.IDNK43_K43



